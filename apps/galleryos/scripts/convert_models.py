"""Builds the on-device models GalleryOS uses for people and sentence search.

Faces:  OpenCV Zoo SFace (Apache 2.0), 112x112 aligned RGB face -> 128-d identity vector.
Search: OpenAI CLIP ViT-B/32 (MIT), 224x224 image -> 512-d vector, 77 tokens -> 512-d vector.

Every model ends with an L2-normalised output named "embedding", so the app only takes dot
products. Run through build_intelligence_models.sh, not directly.
"""

import os
import sys

import numpy as np
import torch

torch.backends.mha.set_fastpath_enabled(False)

import coremltools as ct
import coremltools.optimize.coreml as cto



def cosine(a, b):
    a = np.asarray(a, dtype=np.float32).reshape(-1)
    b = np.asarray(b, dtype=np.float32).reshape(-1)
    return float(np.dot(a, b) / (np.linalg.norm(a) * np.linalg.norm(b) + 1e-9))


def palettize(model, bits):
    # One process only: worker processes re-ran this whole script and exhausted memory.
    op = cto.OpPalettizerConfig(mode="kmeans", nbits=bits, weight_threshold=2048)
    # Only real weights (layers, embeddings). The text tower's attention mask is a constant full
    # of -infinity, which k-means cannot cluster and which must stay exact anyway.
    config = cto.OptimizationConfig(op_type_configs={"linear": op, "matmul": op, "conv": op, "gather": op})
    return cto.palettize_weights(model, config)



def main():
    OUT = sys.argv[1]
    SFACE = sys.argv[2]
    os.makedirs(OUT, exist_ok=True)

    # ---------------------------------------------------------------- faces
    print("\n[1/3] Twarze (SFace)…", flush=True)
    import onnx
    from onnx2torch import convert

    sface = convert(onnx.load(SFACE)).eval()


    class Face(torch.nn.Module):
        def __init__(self, inner):
            super().__init__()
            self.inner = inner

        def forward(self, image):
            vector = self.inner(image).reshape(1, -1)
            return torch.nn.functional.normalize(vector, dim=1)


    face = Face(sface).eval()
    sample = torch.rand(1, 3, 112, 112) * 255.0
    with torch.no_grad():
        reference = face(sample).numpy()
        traced = torch.jit.trace(face, sample)
    face_ml = ct.convert(
        traced,
        inputs=[ct.ImageType(name="image", shape=(1, 3, 112, 112), scale=1.0, color_layout=ct.colorlayout.RGB)],
        outputs=[ct.TensorType(name="embedding")],
        minimum_deployment_target=ct.target.iOS18,
        compute_precision=ct.precision.FLOAT16,
    )
    face_ml.short_description = "GalleryOS face identity (SFace, Apache 2.0)"
    face_ml.save(os.path.join(OUT, "GalleryFace.mlpackage"))
    from PIL import Image

    pixels = (sample[0].permute(1, 2, 0).numpy()).clip(0, 255).astype(np.uint8)
    check = face_ml.predict({"image": Image.fromarray(pixels)})["embedding"]
    with torch.no_grad():
        reference = face(torch.from_numpy(pixels).permute(2, 0, 1).unsqueeze(0).float()).numpy()
    print(f"      zgodność z oryginałem: {cosine(check, reference):.4f}", flush=True)

    # ---------------------------------------------------------------- CLIP
    import open_clip

    clip_model, _, _ = open_clip.create_model_and_transforms("ViT-B-32", pretrained="openai")
    clip_model = clip_model.eval()
    tokenizer = open_clip.get_tokenizer("ViT-B-32")

    MEAN = torch.tensor([0.48145466, 0.4578275, 0.40821073]).view(1, 3, 1, 1)
    STD = torch.tensor([0.26862954, 0.26130258, 0.27577711]).view(1, 3, 1, 1)


    class ImageTower(torch.nn.Module):
        def __init__(self, model):
            super().__init__()
            self.model = model
            self.register_buffer("mean", MEAN)
            self.register_buffer("std", STD)

        def forward(self, image):
            vector = self.model.encode_image((image - self.mean) / self.std)
            return vector / vector.norm(dim=-1, keepdim=True)


    class TextTower(torch.nn.Module):
        def __init__(self, model):
            super().__init__()
            self.model = model

        def forward(self, tokens):
            vector = self.model.encode_text(tokens.long())
            return vector / vector.norm(dim=-1, keepdim=True)


    print("\n[2/3] Obraz (CLIP)… to potrwa kilka minut", flush=True)
    image_tower = ImageTower(clip_model).eval()
    sample = torch.rand(1, 3, 224, 224)
    with torch.no_grad():
        traced = torch.jit.trace(image_tower, sample)
    image_ml = ct.convert(
        traced,
        inputs=[ct.ImageType(name="image", shape=(1, 3, 224, 224), scale=1.0 / 255.0, color_layout=ct.colorlayout.RGB)],
        outputs=[ct.TensorType(name="embedding")],
        minimum_deployment_target=ct.target.iOS18,
        compute_precision=ct.precision.FLOAT16,
    )
    image_ml = palettize(image_ml, 6)
    image_ml.short_description = "GalleryOS image search (OpenAI CLIP ViT-B/32, MIT)"
    image_ml.save(os.path.join(OUT, "GalleryCLIPImage.mlpackage"))
    pixels = (sample[0].permute(1, 2, 0).numpy() * 255).clip(0, 255).astype(np.uint8)
    check = image_ml.predict({"image": Image.fromarray(pixels)})["embedding"]
    with torch.no_grad():
        reference = image_tower(torch.from_numpy(pixels).permute(2, 0, 1).unsqueeze(0).float() / 255.0).numpy()
    print(f"      zgodność z oryginałem: {cosine(check, reference):.4f}", flush=True)

    print("\n[3/3] Tekst (CLIP)…", flush=True)
    text_tower = TextTower(clip_model).eval()
    tokens = tokenizer(["a photo of a dog on the beach at sunset"]).to(torch.int32)
    with torch.no_grad():
        reference = text_tower(tokens).numpy()
        traced = torch.jit.trace(text_tower, tokens)
    text_ml = ct.convert(
        traced,
        inputs=[ct.TensorType(name="tokens", shape=(1, 77), dtype=np.int32)],
        outputs=[ct.TensorType(name="embedding")],
        minimum_deployment_target=ct.target.iOS18,
        compute_precision=ct.precision.FLOAT16,
    )
    text_ml = palettize(text_ml, 6)
    text_ml.short_description = "GalleryOS sentence search (OpenAI CLIP ViT-B/32, MIT)"
    text_ml.save(os.path.join(OUT, "GalleryCLIPText.mlpackage"))
    check = text_ml.predict({"tokens": tokens.numpy().astype(np.int32)})["embedding"]
    print(f"      zgodność z oryginałem: {cosine(check, reference):.4f}", flush=True)

    # Image and text must still meet in one space after compression.
    dog = Image.new("RGB", (224, 224), (40, 120, 200))
    image_vec = image_ml.predict({"image": dog})["embedding"]
    print(f"\nGotowe. Kontrola wspólnej przestrzeni: {cosine(image_vec, check):+.3f}", flush=True)


if __name__ == "__main__":
    main()
