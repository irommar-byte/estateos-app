import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  cleanAttachmentOnlyMessage,
  formatContactAttachmentName,
  type ContactAttachmentMeta,
} from '../../src/utils/contactAttachment';

const encodedName = 'Topic%20%26%20Becky%20G%20%E2%80%94%20Sorry%20Papi.mp3';

const audioAttachment: ContactAttachmentMeta = {
  url: '/uploads/audio.mp3',
  name: encodedName,
  mimeType: 'audio/mpeg',
  size: 123,
};

describe('contact attachment display', () => {
  it('turns URL-encoded filenames into readable titles', () => {
    assert.equal(formatContactAttachmentName(encodedName), 'Topic & Becky G — Sorry Papi.mp3');
  });

  it('hides a filename duplicated as attachment-only message text', () => {
    assert.equal(cleanAttachmentOnlyMessage(encodedName, [audioAttachment]), '');
    assert.equal(cleanAttachmentOnlyMessage(`📎 ${encodedName}`, [audioAttachment]), '');
  });

  it('keeps an actual message caption next to an attachment', () => {
    assert.equal(cleanAttachmentOnlyMessage('Posłuchaj tego nagrania', [audioAttachment]), 'Posłuchaj tego nagrania');
  });
});
