"use client";

import { useCallback, useEffect, useState } from "react";

export type UserGeo = { latitude: number; longitude: number };

export function useUserLocation() {
  const [location, setLocation] = useState<UserGeo | null>(null);
  const [denied, setDenied] = useState(false);
  const [pending, setPending] = useState(false);

  const request = useCallback(() => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setDenied(true);
      return;
    }
    setPending(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
        setDenied(false);
        setPending(false);
      },
      () => {
        setDenied(true);
        setPending(false);
      },
      { enableHighAccuracy: false, timeout: 12000, maximumAge: 120000 },
    );
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const raw = sessionStorage.getItem("estateos_user_geo");
      if (raw) {
        const parsed = JSON.parse(raw) as UserGeo;
        if (Number.isFinite(parsed.latitude) && Number.isFinite(parsed.longitude)) {
          setLocation(parsed);
        }
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    if (!location) return;
    try {
      sessionStorage.setItem("estateos_user_geo", JSON.stringify(location));
    } catch {
      /* ignore */
    }
  }, [location]);

  return { location, denied, pending, request };
}
