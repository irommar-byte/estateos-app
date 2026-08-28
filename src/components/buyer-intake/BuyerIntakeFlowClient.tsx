'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { resolveProfileMediaUrl } from '@/lib/agentProfile';
import { canonicalizeCity, getDistrictsForCity, normalizeText } from '@/lib/location/locationCatalog';
import {
  BUYER_CITY_OPTIONS,
  BUYER_DISTRICT_QUICK,
  BUYER_PROPERTY_OPTIONS,
  BUYER_ROOM_OPTIONS,
  BUYER_SUGGEST_MIN_CHARS,
  BUYER_TIMELINE_OPTIONS,
  BUYER_TRANSACTION_OPTIONS,
  buyerIntakeFreeServiceLine,
  buyerIntakeProgressPercent,
  buyerIntakeStepCaption,
  buyerIntakeBudgetHeading,
  buyerIntakeTimelineHeading,
  buyerIntakeTimelineHint,
  buyerMissionShowsAmenities,
  buyerMissionShowsArea,
  buyerMissionShowsRooms,
  formatBuyerBudget,
  formatBuyerArea,
  formatBuyerDistricts,
  formatBuyerRooms,
  formatBuyerStep3Summary,
  formatBuyerTransactionType,
  getBuyerAreaHeading,
  getBuyerAreaHint,
  getBuyerAreaMaxOptions,
  getBuyerAreaMinOptions,
  getBuyerBudgetOptions,
  getBuyerMustHaveOptionsForPropertyType,
  isBuyerBudgetValueForTransaction,
  isBuyerStep2Complete,
  isBuyerStep3Complete,
  isBuyerStep4Complete,
  listBuyerMustHaves,
  normalizeBuyerDistricts,
  normalizeBuyerRooms,
  normalizeBuyerAreaRange,
  normalizeBuyerContactEmail,
  resolveBuyerUiStep,
  sanitizeBuyerAreaForPropertyType,
  searchBuyerCitySuggestions,
  searchBuyerDistrictSuggestions,
  validateBuyerStep2Location,
  validateBuyerStep4Contact,
  type BuyerMissionRecord,
  type BuyerMustHaveKey,
  type BuyerPropertyType,
  type BuyerPurchaseTimeline,
  type BuyerTransactionType,
} from '@/lib/buyerIntakeShared';
import { BuyerIntakeStep4Contact, BuyerIntakeStep4Footer, type BuyerContactFieldStatus } from '@/components/buyer-intake/BuyerIntakeStep4Contact';
import { BuyerSuggestInput } from '@/components/buyer-intake/BuyerSuggestInput';
import { clientPortalHref, readClientPortalToken, rememberClientPortalToken } from '@/lib/crm/portalSession';
import { normalizePhoneE164 } from '@/lib/phoneE164';

const EASE_OUT = [0.16, 1, 0.3, 1] as const;

const TRUST_POINTS = [
  { icon: ShieldCheck, labelKey: 'free' as const },
  { icon: Clock3, label: '1 minuta' },
  { icon: UserRound, label: 'Agent w pakiecie' },
] as const;

type AgentPreview = {
  displayName: string;
  companyName: string | null;
  agentTitle: string;
  image: string | null;
};

type Props = {
  agent: AgentPreview;
  initialMission?: BuyerMissionRecord | null;
};

function stepProgress(step: 1 | 2 | 3 | 4, intakeComplete: boolean): string {
  return buyerIntakeProgressPercent(step, intakeComplete);
}

function trustPointLabel(item: (typeof TRUST_POINTS)[number], isRent: boolean): string {
  if ('labelKey' in item) {
    return isRent ? 'Bezpłatnie dla najemcy' : 'Bezpłatnie dla Ciebie';
  }
  return item.label;
}

function orderDistrictsForPicker(city: string, all: string[]): string[] {
  const quick = BUYER_DISTRICT_QUICK[city as (typeof BUYER_CITY_OPTIONS)[number]] || [];
  const prioritized = quick.filter((d) => all.includes(d));
  const rest = all.filter((d) => !prioritized.includes(d));
  return [...prioritized, ...rest];
}

function toggleInList<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((item) => item !== value) : [...list, value];
}

function AgentAvatar({ src, initial, compact }: { src: string | null; initial: string; compact?: boolean }) {
  const [broken, setBroken] = useState(false);
  const url = resolveProfileMediaUrl(src);
  const size = compact ? 'size-9 rounded-xl sm:size-10' : 'size-10 rounded-2xl sm:size-11';

  if (!url || broken) {
    return (
      <div
        className={`bi-agent-card__avatar flex shrink-0 items-center justify-center bg-emerald-500/15 font-bold text-emerald-400 ${size} ${compact ? 'text-sm' : 'text-base'}`}
      >
        {initial}
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt=""
      className={`bi-agent-card__avatar shrink-0 object-cover ${size}`}
      onError={() => setBroken(true)}
    />
  );
}

function ChoiceChip({
  label,
  active,
  disabled,
  onSelect,
  compact,
  fill,
}: {
  label: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
  compact?: boolean;
  fill?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={active}
      className={`bi-choice-chip ${active ? 'bi-choice-chip--active' : ''} ${compact ? 'bi-choice-chip--compact' : ''} ${fill ? 'bi-choice-chip--fill' : ''}`}
    >
      {active ? <Check className="bi-choice-chip__check size-3 shrink-0" strokeWidth={3} aria-hidden /> : null}
      <span>{label}</span>
    </button>
  );
}

function TransactionSegment({
  value,
  disabled,
  onChange,
}: {
  value: BuyerTransactionType;
  disabled?: boolean;
  onChange: (value: BuyerTransactionType) => void;
}) {
  const reduceMotion = useReducedMotion();
  const isRent = value === 'RENT';

  return (
    <div className="bi-transaction-segment" role="group" aria-label="Kupno lub wynajem">
      <motion.span
        className="bi-transaction-segment__thumb"
        initial={false}
        animate={{ x: isRent ? '100%' : '0%' }}
        transition={reduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 420, damping: 34 }}
        aria-hidden
      />
      {BUYER_TRANSACTION_OPTIONS.map((option) => (
        <button
          key={option.id}
          type="button"
          disabled={disabled}
          aria-pressed={value === option.id}
          onClick={() => onChange(option.id)}
          className={`bi-transaction-segment__btn ${value === option.id ? 'bi-transaction-segment__btn--active' : ''}`}
        >
          <span className="bi-transaction-segment__label">{option.label}</span>
          <span className="bi-transaction-segment__hint">{option.hint}</span>
        </button>
      ))}
    </div>
  );
}

function MustHaveChip({
  label,
  hint,
  active,
  disabled,
  onSelect,
}: {
  label: string;
  hint: string;
  active: boolean;
  disabled?: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={active}
      className={`bi-must-have-chip ${active ? 'bi-must-have-chip--active' : ''}`}
    >
      <span className="bi-must-have-chip__row flex items-center gap-1.5">
        {active ? <Check className="bi-must-have-chip__check size-3 shrink-0" strokeWidth={3} aria-hidden /> : null}
        <span className="bi-must-have-chip__label text-[11px] font-semibold leading-tight sm:text-[12px]">{label}</span>
      </span>
      <span className="bi-must-have-chip__hint mt-0.5 block text-[9px] leading-snug opacity-75">{hint}</span>
    </button>
  );
}

function PropertyTypeCard({
  option,
  active,
  disabled,
  index,
  onSelect,
}: {
  option: (typeof BUYER_PROPERTY_OPTIONS)[number];
  active: boolean;
  disabled: boolean;
  index: number;
  onSelect: () => void;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onSelect}
      initial={reduceMotion ? false : { opacity: 0, y: 12 }}
      animate={{ opacity: disabled ? 0.82 : 1, y: 0 }}
      transition={{ delay: reduceMotion ? 0 : 0.04 + index * 0.03, duration: 0.32, ease: EASE_OUT }}
      whileTap={reduceMotion || disabled ? undefined : { scale: 0.975, transition: { duration: 0.12 } }}
      className={`bi-type-card bi-type-card--fit flex flex-col rounded-[1rem] p-2.5 text-left sm:rounded-[1.1rem] sm:p-3 ${
        active ? 'bi-type-card--active' : ''
      }`}
      aria-pressed={active}
    >
      <span className="bi-type-card__glow" aria-hidden />
      <div className="bi-type-card__top mb-1">
        <span className="bi-type-card__emoji text-base sm:text-lg">{option.emoji}</span>
        <AnimatePresence mode="popLayout">
          {active ? (
            <motion.span
              key="check"
              initial={reduceMotion ? false : { scale: 0.4, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.4, opacity: 0 }}
              className="bi-type-card__check bi-type-card__check--sm"
              aria-hidden
            >
              <Check className="size-3" strokeWidth={3} />
            </motion.span>
          ) : null}
        </AnimatePresence>
      </div>
      <p className="bi-type-card__label text-[12px] font-semibold leading-snug sm:text-[13px]">{option.label}</p>
      <p className="bi-type-card__hint bi-type-card__hint--hide-short mt-auto pt-0.5 text-[9px] leading-snug sm:text-[10px]">
        {option.hint}
      </p>
    </motion.button>
  );
}

export default function BuyerIntakeFlowClient({ agent, initialMission = null }: Props) {
  const router = useRouter();
  const reduceMotion = useReducedMotion();
  const firstName = agent.displayName.split(/\s+/)[0] || agent.displayName;

  const [uiStep, setUiStep] = useState<1 | 2 | 3 | 4>(() => resolveBuyerUiStep(initialMission));
  const [propertyType, setPropertyType] = useState<BuyerPropertyType | null>(initialMission?.propertyType ?? null);
  const [city, setCity] = useState(initialMission?.city ?? '');
  const [customCity, setCustomCity] = useState(() => {
    const c = initialMission?.city ?? '';
    return c && !BUYER_CITY_OPTIONS.includes(c as (typeof BUYER_CITY_OPTIONS)[number]) ? c : '';
  });
  const [budgetMax, setBudgetMax] = useState<number | null>(() => {
    const value = initialMission?.budgetMax ?? null;
    const tx = initialMission?.transactionType ?? 'SELL';
    const type = initialMission?.propertyType ?? 'apartment';
    return isBuyerBudgetValueForTransaction(value, tx, type) ? value : null;
  });
  const [minArea, setMinArea] = useState<number | null>(() => {
    const sanitized = sanitizeBuyerAreaForPropertyType(
      initialMission?.propertyType ?? null,
      initialMission?.minArea ?? null,
      initialMission?.maxArea ?? null,
    );
    return sanitized.minArea;
  });
  const [maxArea, setMaxArea] = useState<number | null>(() => {
    const sanitized = sanitizeBuyerAreaForPropertyType(
      initialMission?.propertyType ?? null,
      initialMission?.minArea ?? null,
      initialMission?.maxArea ?? null,
    );
    return sanitized.maxArea;
  });
  const [rooms, setRooms] = useState<number[]>(() => normalizeBuyerRooms(initialMission?.rooms ?? []));
  const [districts, setDistricts] = useState<string[]>(() => normalizeBuyerDistricts(initialMission?.districts ?? []));
  const [customDistrict, setCustomDistrict] = useState('');
  const [districtFilter, setDistrictFilter] = useState('');
  const [districtsExpanded, setDistrictsExpanded] = useState(false);
  const [step2Saved, setStep2Saved] = useState(() => isBuyerStep2Complete(initialMission));
  const [step3Saved, setStep3Saved] = useState(() => isBuyerStep3Complete(initialMission));
  const [step4Saved, setStep4Saved] = useState(() => isBuyerStep4Complete(initialMission));
  const [contactFirstName, setContactFirstName] = useState(initialMission?.firstName ?? '');
  const [contactLastName, setContactLastName] = useState(initialMission?.lastName ?? '');
  const [contactPhone, setContactPhone] = useState(initialMission?.phone ?? '');
  const [contactEmail, setContactEmail] = useState(initialMission?.email ?? '');
  const [consentContact, setConsentContact] = useState(initialMission?.consentContact ?? false);
  const [phoneStatus, setPhoneStatus] = useState<BuyerContactFieldStatus>('idle');
  const [emailStatus, setEmailStatus] = useState<BuyerContactFieldStatus>('idle');
  const [contactKnownHint, setContactKnownHint] = useState('');
  const contactCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [requireBalcony, setRequireBalcony] = useState(initialMission?.requireBalcony ?? false);
  const [requireGarden, setRequireGarden] = useState(initialMission?.requireGarden ?? false);
  const [requireElevator, setRequireElevator] = useState(initialMission?.requireElevator ?? false);
  const [requireParking, setRequireParking] = useState(initialMission?.requireParking ?? false);
  const [requireFurnished, setRequireFurnished] = useState(initialMission?.requireFurnished ?? false);
  const [requireTwoLevel, setRequireTwoLevel] = useState(initialMission?.requireTwoLevel ?? false);
  const [transactionType, setTransactionType] = useState<BuyerTransactionType>(
    initialMission?.transactionType ?? 'SELL',
  );
  const [purchaseTimeline, setPurchaseTimeline] = useState<BuyerPurchaseTimeline | null>(
    initialMission?.purchaseTimeline ?? null,
  );

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [remoteCitySuggestions, setRemoteCitySuggestions] = useState<string[]>([]);
  const [citySuggestLoading, setCitySuggestLoading] = useState(false);

  const selectedLabel = BUYER_PROPERTY_OPTIONS.find((item) => item.id === propertyType)?.label;
  const resolvedCity = useMemo(() => {
    if (customCity.trim()) return customCity.trim();
    return city.trim();
  }, [city, customCity]);

  const showRooms = buyerMissionShowsRooms(propertyType);
  const showArea = buyerMissionShowsArea(propertyType);
  const showAmenities = buyerMissionShowsAmenities(propertyType);
  const isRent = transactionType === 'RENT';
  const intakeComplete = step4Saved;
  const budgetOptions = useMemo(
    () => getBuyerBudgetOptions(transactionType, propertyType),
    [transactionType, propertyType],
  );
  const areaMinOptions = useMemo(() => getBuyerAreaMinOptions(propertyType), [propertyType]);
  const mustHaveOptions = useMemo(() => getBuyerMustHaveOptionsForPropertyType(propertyType), [propertyType]);
  const transactionLabel = formatBuyerTransactionType(transactionType) ?? 'Kupno';
  const selectedMustHaves = useMemo(
    () =>
      listBuyerMustHaves({
        requireBalcony,
        requireGarden,
        requireElevator,
        requireParking,
        requireFurnished,
        requireTwoLevel,
      }).filter((label) => mustHaveOptions.some((option) => option.label === label)),
    [
      requireBalcony,
      requireGarden,
      requireElevator,
      requireParking,
      requireFurnished,
      requireTwoLevel,
      mustHaveOptions,
    ],
  );
  const step2Ready = Boolean(resolvedCity && budgetMax);
  const maxAreaOptions = useMemo(() => {
    const options = getBuyerAreaMaxOptions(propertyType);
    if (minArea == null) return options;
    return options.filter((value) => value >= minArea);
  }, [propertyType, minArea]);

  const catalogDistricts = useMemo(() => getDistrictsForCity(resolvedCity), [resolvedCity]);
  const orderedDistricts = useMemo(
    () => orderDistrictsForPicker(resolvedCity, catalogDistricts),
    [resolvedCity, catalogDistricts],
  );
  const filteredDistricts = useMemo(() => {
    const q = districtFilter.trim().toLowerCase();
    if (!q) return orderedDistricts;
    return orderedDistricts.filter((d) => d.toLowerCase().includes(q));
  }, [orderedDistricts, districtFilter]);
  const visibleDistricts = useMemo(() => {
    if (districtFilter.trim() || districtsExpanded) return filteredDistricts;
    return filteredDistricts.slice(0, 8);
  }, [filteredDistricts, districtFilter, districtsExpanded]);
  const resolvedDistricts = useMemo(() => {
    const merged = normalizeBuyerDistricts([...districts, customDistrict.trim()].filter(Boolean));
    return merged;
  }, [districts, customDistrict]);

  const localCitySuggestions = useMemo(
    () => searchBuyerCitySuggestions(customCity, 8),
    [customCity],
  );

  const citySuggestionOptions = useMemo(() => {
    const merged: string[] = [...localCitySuggestions];
    const seen = new Set(merged.map((item) => normalizeText(item)));
    for (const item of remoteCitySuggestions) {
      const key = normalizeText(item);
      if (seen.has(key)) continue;
      seen.add(key);
      merged.push(item);
    }
    return merged.slice(0, 8).map((item) => ({ id: item, label: item, value: item }));
  }, [localCitySuggestions, remoteCitySuggestions]);

  const districtFilterSuggestions = useMemo(() => {
    if (!resolvedCity || !catalogDistricts.length) return [];
    return searchBuyerDistrictSuggestions(resolvedCity, districtFilter, 8).map((item) => ({
      id: `filter-${item}`,
      label: item,
      value: item,
    }));
  }, [resolvedCity, catalogDistricts.length, districtFilter]);

  const customDistrictSuggestions = useMemo(() => {
    if (!resolvedCity || !catalogDistricts.length) return [];
    return searchBuyerDistrictSuggestions(resolvedCity, customDistrict, 8).map((item) => ({
      id: `custom-${item}`,
      label: item,
      value: item,
    }));
  }, [resolvedCity, catalogDistricts.length, customDistrict]);

  useEffect(() => {
    const query = customCity.trim();
    if (query.length < BUYER_SUGGEST_MIN_CHARS) {
      setRemoteCitySuggestions([]);
      setCitySuggestLoading(false);
      return;
    }

    const handle = window.setTimeout(async () => {
      setCitySuggestLoading(true);
      try {
        const response = await fetch(
          `/api/buyer-intake/city-suggest?q=${encodeURIComponent(query)}`,
        );
        const data = await response.json().catch(() => ({}));
        const suggestions = Array.isArray(data?.suggestions) ? data.suggestions : [];
        setRemoteCitySuggestions(suggestions.filter((item: unknown) => typeof item === 'string'));
      } catch {
        setRemoteCitySuggestions([]);
      } finally {
        setCitySuggestLoading(false);
      }
    }, 220);

    return () => window.clearTimeout(handle);
  }, [customCity]);

  const step2Summary = useMemo(() => {
    const parts: string[] = [];
    if (resolvedCity) {
      const districtLabel = formatBuyerDistricts(resolvedDistricts);
      parts.push(districtLabel ? `${resolvedCity}, ${districtLabel}` : resolvedCity);
    }
    if (budgetMax) parts.push(formatBuyerBudget(budgetMax, transactionType));
    const areaLabel = showArea ? formatBuyerArea(minArea, maxArea) : null;
    if (areaLabel) parts.push(areaLabel);
    const roomsLabel = showRooms ? formatBuyerRooms(rooms) : null;
    if (roomsLabel) parts.push(roomsLabel);
    return parts;
  }, [resolvedCity, resolvedDistricts, budgetMax, minArea, maxArea, rooms, showArea, showRooms, transactionType]);

  const step3Summary = useMemo(
    () =>
      formatBuyerStep3Summary({
        typ: 'buyer_mission',
        v: 2,
        agentUserId: initialMission?.agentUserId ?? 0,
        propertyType,
        step: 3,
        city: resolvedCity || null,
        districts: resolvedDistricts,
        budgetMax,
        minArea,
        maxArea,
        rooms,
        requireBalcony,
        requireGarden,
        requireElevator,
        requireParking,
        requireFurnished,
        requireTwoLevel,
        marketType: null,
        transactionType,
        purchaseTimeline,
        firstName: contactFirstName || null,
        lastName: contactLastName || null,
        email: contactEmail || null,
        phone: contactPhone || null,
        clientId: initialMission?.clientId ?? null,
        consentContact,
      }),
    [
      initialMission?.agentUserId,
      propertyType,
      resolvedCity,
      resolvedDistricts,
      budgetMax,
      minArea,
      maxArea,
      rooms,
      requireBalcony,
      requireGarden,
      requireElevator,
      requireParking,
      requireFurnished,
      requireTwoLevel,
      transactionType,
      purchaseTimeline,
    ],
  );

  const mustHaveValue = (key: BuyerMustHaveKey): boolean => {
    switch (key) {
      case 'requireBalcony':
        return requireBalcony;
      case 'requireGarden':
        return requireGarden;
      case 'requireElevator':
        return requireElevator;
      case 'requireParking':
        return requireParking;
      case 'requireFurnished':
        return requireFurnished;
      case 'requireTwoLevel':
        return requireTwoLevel;
      default:
        return false;
    }
  };

  const toggleMustHave = (key: BuyerMustHaveKey) => {
    const next = !mustHaveValue(key);
    switch (key) {
      case 'requireBalcony':
        setRequireBalcony(next);
        break;
      case 'requireGarden':
        setRequireGarden(next);
        break;
      case 'requireElevator':
        setRequireElevator(next);
        break;
      case 'requireParking':
        setRequireParking(next);
        break;
      case 'requireFurnished':
        setRequireFurnished(next);
        break;
      case 'requireTwoLevel':
        setRequireTwoLevel(next);
        break;
      default:
        break;
    }
    setStep3Saved(false);
    setError('');
  };

  const handleTransactionChange = (next: BuyerTransactionType) => {
    setTransactionType(next);
    setBudgetMax((prev) => (isBuyerBudgetValueForTransaction(prev, next, propertyType) ? prev : null));
    setStep2Saved(false);
    setStep3Saved(false);
    setError('');
  };

  const handlePropertyTypeSelect = (next: BuyerPropertyType) => {
    setPropertyType(next);
    setBudgetMax((prev) => (isBuyerBudgetValueForTransaction(prev, transactionType, next) ? prev : null));
    const sanitizedArea = sanitizeBuyerAreaForPropertyType(next, minArea, maxArea);
    setMinArea(sanitizedArea.minArea);
    setMaxArea(sanitizedArea.maxArea);
    if (next === 'plot' || next === 'commercial') {
      setRequireBalcony(false);
      setRequireGarden(false);
    }
    if (next === 'plot') {
      setRequireElevator(false);
      setRequireParking(false);
      setRequireFurnished(false);
      setRequireTwoLevel(false);
      setRooms([]);
    }
    if (next === 'house') {
      setRequireElevator(false);
    }
    if (next === 'commercial') {
      setRequireBalcony(false);
      setRequireGarden(false);
    }
    if (next !== 'apartment' && next !== 'house') {
      setRooms([]);
    }
    setStep2Saved(false);
    setStep3Saved(false);
    setError('');
  };

  const handleStep1Continue = async () => {
    if (!propertyType || submitting) return;
    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/buyer-intake/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ step: 1, propertyType, transactionType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || 'Nie udało się zapisać wyboru.'));
      }
      setUiStep(2);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać wyboru.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep2Continue = async () => {
    if (!step2Ready || submitting || !propertyType) return;

    const location = validateBuyerStep2Location({
      city: resolvedCity,
      districts,
      customDistrict,
    });
    if (!location.ok) {
      setError(location.error);
      return;
    }

    const areaRange = normalizeBuyerAreaRange({ minArea, maxArea });
    if (areaRange.error) {
      setError(areaRange.error);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/buyer-intake/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: 2,
          city: location.city,
          districts: location.districts,
          budgetMax,
          minArea: showArea ? areaRange.minArea : null,
          maxArea: showArea ? areaRange.maxArea : null,
          rooms: showRooms ? rooms : [],
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || 'Nie udało się zapisać kryteriów.'));
      }
      setStep2Saved(true);
      setUiStep(3);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać kryteriów.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStep3Continue = async () => {
    if (submitting || !propertyType) return;

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/buyer-intake/mission', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          step: 3,
          requireBalcony: showAmenities ? requireBalcony : false,
          requireGarden: showAmenities ? requireGarden : false,
          requireElevator: showAmenities ? requireElevator : false,
          requireParking: showAmenities ? requireParking : false,
          requireFurnished: showAmenities ? requireFurnished : false,
          requireTwoLevel: showAmenities ? requireTwoLevel : false,
          purchaseTimeline,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || 'Nie udało się zapisać preferencji.'));
      }
      setStep3Saved(true);
      setUiStep(4);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się zapisać preferencji.');
    } finally {
      setSubmitting(false);
    }
  };

  const step4Ready = useMemo(() => {
    const check = validateBuyerStep4Contact({
      firstName: contactFirstName,
      lastName: contactLastName,
      phone: contactPhone,
      email: contactEmail,
      consentContact,
    });
    if (!check.ok) return false;
    if (phoneStatus === 'invalid' || emailStatus === 'invalid') return false;
    if (phoneStatus === 'checking' || emailStatus === 'checking') return false;
    return true;
  }, [
    contactFirstName,
    contactLastName,
    contactPhone,
    contactEmail,
    consentContact,
    phoneStatus,
    emailStatus,
  ]);

  useEffect(() => {
    const phoneE164 = normalizePhoneE164(contactPhone);
    const emailNorm = normalizeBuyerContactEmail(contactEmail);
    const emailRaw = contactEmail.trim();

    if (!phoneE164 && !emailRaw) {
      setPhoneStatus('idle');
      setEmailStatus('idle');
      setContactKnownHint('');
      return;
    }

    if (contactPhone && !phoneE164) {
      setPhoneStatus('invalid');
    } else if (phoneE164) {
      setPhoneStatus('checking');
    }

    if (emailRaw && !emailNorm) {
      setEmailStatus('invalid');
    } else if (emailNorm) {
      setEmailStatus('checking');
    } else {
      setEmailStatus('idle');
    }

    if (contactCheckTimer.current) clearTimeout(contactCheckTimer.current);
    contactCheckTimer.current = setTimeout(async () => {
      if (!phoneE164 && !emailNorm) return;

      try {
        const params = new URLSearchParams();
        if (phoneE164) params.set('phone', phoneE164);
        if (emailNorm) params.set('email', emailNorm);
        const res = await fetch(`/api/buyer-intake/contact-check?${params.toString()}`, { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok || !data?.success) return;

        if (phoneE164) {
          if (data.phoneValid === false) setPhoneStatus('invalid');
          else if (data.phoneInCrm) setPhoneStatus('known');
          else setPhoneStatus('valid');
        }

        if (emailNorm) {
          if (data.emailValid === false) setEmailStatus('invalid');
          else if (data.emailInCrm) setEmailStatus('known');
          else setEmailStatus('valid');
        }

        if (data.existingClient?.firstName) {
          setContactKnownHint(
            `${data.existingClient.firstName} — mamy Cię już u agenta. Otworzymy Twój panel.`,
          );
        } else {
          setContactKnownHint('');
        }
      } catch {
        if (phoneE164) setPhoneStatus('valid');
        if (emailNorm) setEmailStatus('valid');
      }
    }, 450);

    return () => {
      if (contactCheckTimer.current) clearTimeout(contactCheckTimer.current);
    };
  }, [contactPhone, contactEmail]);

  useEffect(() => {
    if (!step4Saved) return;
    const token = readClientPortalToken();
    if (token) {
      router.replace(`${clientPortalHref(token)}?from=szukam`);
    }
  }, [step4Saved, router]);

  const handleContactEmailBlur = () => {
    const normalized = normalizeBuyerContactEmail(contactEmail);
    if (normalized && normalized !== contactEmail.trim().toLowerCase()) {
      setContactEmail(normalized);
    }
  };

  const fullSummaryLine = useMemo(() => {
    const parts = [...step2Summary, ...step3Summary];
    return parts.join(' · ');
  }, [step2Summary, step3Summary]);

  const handleStep4Continue = async () => {
    if (submitting || !step4Ready) return;
    const check = validateBuyerStep4Contact({
      firstName: contactFirstName,
      lastName: contactLastName,
      phone: contactPhone,
      email: contactEmail,
      consentContact,
    });
    if (!check.ok) {
      setError(check.error);
      return;
    }

    setSubmitting(true);
    setError('');
    try {
      const res = await fetch('/api/buyer-intake/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          firstName: check.firstName,
          lastName: check.lastName,
          phone: check.phone,
          email: check.email,
          consentContact: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || 'Nie udało się wysłać zgłoszenia.'));
      }
      if (data.portalToken) {
        rememberClientPortalToken(String(data.portalToken));
        const qs = new URLSearchParams({ from: 'szukam' });
        if (data.welcomeEmailSent) qs.set('mail', '1');
        router.push(`${clientPortalHref(String(data.portalToken))}?${qs.toString()}`);
        return;
      }
      setStep4Saved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Nie udało się wysłać zgłoszenia.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCitySelect = (value: string) => {
    setCity(value);
    setCustomCity('');
    setDistricts([]);
    setCustomDistrict('');
    setDistrictFilter('');
    setDistrictsExpanded(false);
    setStep2Saved(false);
    setError('');
  };

  const handleCustomCityChange = (value: string) => {
    setCustomCity(value);
    setCity('');
    setDistricts([]);
    setCustomDistrict('');
    setDistrictFilter('');
    setDistrictsExpanded(false);
    setStep2Saved(false);
    setError('');
  };

  const toggleDistrict = (value: string) => {
    setDistricts((prev) => toggleInList(prev, value));
    setStep2Saved(false);
    setError('');
  };

  const handleCitySuggestionSelect = (value: string) => {
    const canonical = canonicalizeCity(value) || value.trim();
    if (BUYER_CITY_OPTIONS.includes(canonical as (typeof BUYER_CITY_OPTIONS)[number])) {
      handleCitySelect(canonical);
      return;
    }
    setCustomCity(canonical);
    setCity('');
    setDistricts([]);
    setCustomDistrict('');
    setDistrictFilter('');
    setDistrictsExpanded(false);
    setStep2Saved(false);
    setError('');
  };

  const handleDistrictSuggestionSelect = (value: string) => {
    setDistricts((prev) => normalizeBuyerDistricts([...prev, value]));
    setCustomDistrict('');
    setDistrictFilter('');
    setStep2Saved(false);
    setError('');
  };

  const toggleRoom = (value: number) => {
    setRooms((prev) => {
      const next = toggleInList(prev, value).sort((a, b) => a - b);
      return next;
    });
    setStep2Saved(false);
  };

  return (
    <main className="bi-page relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -left-24 top-8 h-48 w-48 rounded-full bg-emerald-400/10 blur-3xl sm:h-56 sm:w-56" />
        <div className="absolute -right-16 bottom-16 h-48 w-48 rounded-full bg-sky-400/10 blur-3xl sm:h-64 sm:w-64" />
      </div>

      <div className="bi-page__body relative mx-auto flex w-full max-w-xl min-h-0 flex-1 flex-col px-4 pt-[max(0.65rem,env(safe-area-inset-top,0px)+0.5rem)] sm:px-6 sm:pt-5">
        <header className="bi-page__header shrink-0">
          <div className={`bi-step-track mb-2 sm:mb-2.5 ${intakeComplete ? 'bi-step-track--complete' : ''}`} aria-hidden>
            <motion.span
              className="bi-step-track__fill"
              initial={reduceMotion ? false : { width: '0%' }}
              animate={{ width: stepProgress(uiStep, intakeComplete) }}
              transition={{ duration: 0.55, ease: EASE_OUT }}
            />
          </div>

          <div className="flex items-center gap-2.5">
            <div className="bi-brand-mark flex size-9 items-center justify-center rounded-xl border border-white/60 bg-white/70 shadow-sm backdrop-blur-md dark:border-white/10 dark:bg-white/5 sm:size-10 sm:rounded-2xl">
              <Sparkles className="size-4 text-emerald-500 sm:size-[18px]" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-400 sm:text-[10px]">
                Bezpłatnie dla kupujących
              </p>
              <p className="text-[12px] font-medium text-slate-500 dark:text-slate-400 sm:text-[13px]">
                {buyerIntakeStepCaption(uiStep, intakeComplete)}
              </p>
            </div>
            {uiStep === 2 && !step2Saved ? (
              <button
                type="button"
                onClick={() => setUiStep(1)}
                className="bi-back-btn inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                <ArrowLeft className="size-3.5" />
                Wstecz
              </button>
            ) : null}
            {uiStep === 4 && !step4Saved ? (
              <button
                type="button"
                onClick={() => {
                  setUiStep(3);
                  setStep4Saved(false);
                  setError('');
                }}
                className="bi-back-btn inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                <ArrowLeft className="size-3.5" />
                Wstecz
              </button>
            ) : null}
            {uiStep === 3 ? (
              <button
                type="button"
                onClick={() => {
                  setUiStep(2);
                  setStep2Saved(false);
                  setError('');
                }}
                className="bi-back-btn inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-1 text-[11px] font-semibold text-slate-500 dark:text-slate-400"
              >
                <ArrowLeft className="size-3.5" />
                Wstecz
              </button>
            ) : null}
          </div>
        </header>

        <div className="bi-page__main mt-2 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain sm:mt-3">
          {uiStep === 1 ? (
            <motion.div
              key="step1"
              initial={reduceMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, ease: EASE_OUT }}
              className="flex min-h-0 flex-1 flex-col"
            >
                <section className="bi-page__intro shrink-0">
                  <h1 className="bi-page__headline text-[1.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[1.85rem]">
                    {isRent ? (
                      <>
                        Wynajmiemy{' '}
                        <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-300 dark:to-emerald-500">
                          za Ciebie
                        </span>
                      </>
                    ) : (
                      <>
                        Znajdziemy to{' '}
                        <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-300 dark:to-emerald-500">
                          za Ciebie
                        </span>
                      </>
                    )}
                  </h1>
                  <p className="bi-page__lede mt-1.5 max-w-md text-[13px] leading-snug text-slate-600 dark:text-slate-300 sm:text-[14px]">
                    <span className="font-semibold text-slate-900 dark:text-white">{firstName}</span>{' '}
                    {isRent
                      ? 'poprowadzi wyszukiwanie najmu w pakiecie — bezpłatnie dla Ciebie. Bez kontaktu z właścicielami.'
                      : 'poprowadzi wyszukiwanie w pakiecie — bezpłatnie dla kupujących. Bez rozmów ze sprzedającymi.'}
                  </p>
                  <p className="mt-1 max-w-md text-[11px] leading-snug text-slate-500 dark:text-slate-400">
                    {buyerIntakeFreeServiceLine(transactionType)}
                  </p>
                  <ul className="bi-trust-row mt-2 flex flex-wrap gap-1.5">
                    {TRUST_POINTS.map(({ icon: Icon, ...item }) => (
                      <li key={'label' in item ? item.label : item.labelKey} className="bi-trust-chip inline-flex items-center gap-1 rounded-full px-2 py-1">
                        <Icon className="size-3 shrink-0 text-emerald-500" aria-hidden />
                        <span>{trustPointLabel({ icon: Icon, ...item }, isRent)}</span>
                      </li>
                    ))}
                  </ul>
                </section>

                <section className="bi-form-block mt-2 shrink-0 sm:mt-2.5" aria-labelledby="bi-transaction-heading">
                  <div className="mb-2">
                    <h2 id="bi-transaction-heading" className="bi-form-block__title">
                      Kupno czy wynajem?
                    </h2>
                    <p className="bi-form-block__hint mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                      Od tego zależy budżet i dopasowanie ofert
                    </p>
                  </div>
                  <TransactionSegment
                    value={transactionType}
                    disabled={submitting}
                    onChange={handleTransactionChange}
                  />
                </section>

                <section
                  className="bi-agent-card bi-agent-card--compact mt-2 flex shrink-0 items-center gap-2.5 rounded-[1rem] border p-2 sm:mt-2.5 sm:rounded-[1.15rem] sm:p-2.5"
                  aria-label={`Twój agent: ${agent.displayName}`}
                >
                  <AgentAvatar src={agent.image} initial={firstName.slice(0, 1)} compact />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-semibold text-slate-900 dark:text-white">{agent.displayName}</p>
                    <p className="truncate text-[10px] text-slate-500 dark:text-slate-400 sm:text-[11px]">
                      {agent.agentTitle} · {agent.companyName || 'EstateOS™'}
                    </p>
                  </div>
                </section>

                <section className="mt-2 flex min-h-0 flex-1 flex-col justify-end sm:mt-2.5" aria-labelledby="bi-type-heading">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h2
                      id="bi-type-heading"
                      className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400 sm:text-xs"
                    >
                      Co szukasz?
                    </h2>
                    {selectedLabel ? (
                      <p className="truncate text-[10px] font-semibold text-emerald-500 sm:text-[11px]">✓ {selectedLabel}</p>
                    ) : null}
                  </div>
                  <div className="bi-type-grid grid min-h-0 flex-1 grid-cols-2 gap-1.5 sm:gap-2">
                    {BUYER_PROPERTY_OPTIONS.map((option, index) => (
                      <PropertyTypeCard
                        key={option.id}
                        option={option}
                        active={propertyType === option.id}
                        disabled={submitting}
                        index={index}
                        onSelect={() => handlePropertyTypeSelect(option.id)}
                      />
                    ))}
                  </div>
                </section>
              </motion.div>
            ) : uiStep === 2 ? (
              <motion.div
                key="step2"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <>
                  <section className="shrink-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="bi-transaction-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                        {transactionLabel}
                      </span>
                      {selectedLabel ? (
                        <span className="bi-property-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                          {BUYER_PROPERTY_OPTIONS.find((o) => o.id === propertyType)?.emoji} {selectedLabel}
                        </span>
                      ) : null}
                    </div>
                    <h1 className="text-[1.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[1.75rem]">
                      Gdzie i{' '}
                      <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-300 dark:to-emerald-500">
                        {isRent ? 'w jakim budżecie?' : 'za ile?'}
                      </span>
                    </h1>
                    <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                      {firstName} zawęzi {isRent ? 'oferty najmu' : 'rynek'} — wybierz lokalizację
                      {isRent ? ' i maksymalny czynsz.' : ' i budżet.'}
                    </p>
                  </section>

                  <div className="bi-step2-fields mt-2 shrink-0 space-y-2 pb-1 sm:mt-2.5 sm:space-y-2.5">
                      <section className="bi-form-block" aria-labelledby="bi-city-heading">
                        <div className="bi-form-block__head mb-1.5 flex items-center gap-1.5">
                          <MapPin className="size-3.5 text-emerald-500" aria-hidden />
                          <h2 id="bi-city-heading" className="bi-form-block__title">
                            Miasto
                          </h2>
                        </div>
                        <div className="bi-chip-grid grid grid-cols-4 gap-1 sm:gap-1.5">
                          {BUYER_CITY_OPTIONS.map((option) => (
                            <ChoiceChip
                              key={option}
                              label={option}
                              active={city === option && !customCity}
                              disabled={submitting}
                              compact
                              fill
                              onSelect={() => handleCitySelect(option)}
                            />
                          ))}
                        </div>
                        <BuyerSuggestInput
                          value={customCity}
                          onChange={handleCustomCityChange}
                          onSelect={handleCitySuggestionSelect}
                          placeholder="Inne miasto…"
                          disabled={submitting}
                          suggestions={citySuggestionOptions}
                          loading={citySuggestLoading}
                          ariaLabel="Inne miasto"
                          className="mt-1.5"
                        />
                      </section>

                      {resolvedCity && catalogDistricts.length > 0 ? (
                        <section className="bi-form-block" aria-labelledby="bi-district-heading">
                          <div className="mb-1.5">
                            <h2 id="bi-district-heading" className="bi-form-block__title">
                              Dzielnica (opcjonalnie)
                            </h2>
                            <p className="bi-form-block__hint mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                              Możesz zaznaczyć kilka — np. tylko Żoliborz
                            </p>
                          </div>
                          {catalogDistricts.length > 8 ? (
                            <BuyerSuggestInput
                              value={districtFilter}
                              onChange={(value) => setDistrictFilter(value)}
                              onSelect={handleDistrictSuggestionSelect}
                              placeholder="Szukaj dzielnicy…"
                              disabled={submitting}
                              suggestions={districtFilterSuggestions}
                              compact
                              className="mb-1.5"
                              ariaLabel="Szukaj dzielnicy"
                            />
                          ) : null}
                          <div className="bi-district-grid grid grid-cols-2 gap-1 sm:grid-cols-3 sm:gap-1.5">
                            {visibleDistricts.map((option) => (
                              <ChoiceChip
                                key={option}
                                label={option}
                                active={districts.includes(option)}
                                disabled={submitting}
                                compact
                                fill
                                onSelect={() => toggleDistrict(option)}
                              />
                            ))}
                          </div>
                          {!districtFilter.trim() && filteredDistricts.length > 8 ? (
                            <button
                              type="button"
                              disabled={submitting}
                              onClick={() => setDistrictsExpanded((v) => !v)}
                              className="bi-expand-btn mt-1.5 inline-flex w-full items-center justify-center gap-1 rounded-lg py-1 text-[10px] font-semibold text-emerald-500"
                            >
                              {districtsExpanded ? 'Mniej dzielnic' : `Pokaż wszystkie (${filteredDistricts.length})`}
                              <ChevronDown className={`size-3 transition-transform ${districtsExpanded ? 'rotate-180' : ''}`} />
                            </button>
                          ) : null}
                          <BuyerSuggestInput
                            value={customDistrict}
                            onChange={(value) => {
                              setCustomDistrict(value);
                              setStep2Saved(false);
                              setError('');
                            }}
                            onSelect={handleDistrictSuggestionSelect}
                            placeholder="Inna dzielnica…"
                            disabled={submitting}
                            suggestions={customDistrictSuggestions}
                            compact
                            className="mt-1.5"
                            ariaLabel="Inna dzielnica"
                          />
                        </section>
                      ) : resolvedCity ? (
                        <section className="bi-form-block" aria-labelledby="bi-district-custom-heading">
                          <h2 id="bi-district-custom-heading" className="bi-form-block__title mb-1.5">
                            Dzielnica / okolica (opcjonalnie)
                          </h2>
                          <BuyerSuggestInput
                            value={customDistrict}
                            onChange={(value) => {
                              setCustomDistrict(value);
                              setStep2Saved(false);
                              setError('');
                            }}
                            onSelect={(value) => {
                              setCustomDistrict(value);
                              setStep2Saved(false);
                              setError('');
                            }}
                            placeholder="np. centrum, osiedle…"
                            disabled={submitting}
                            suggestions={[]}
                            ariaLabel="Dzielnica lub okolica"
                          />
                        </section>
                      ) : null}

                      <section className="bi-form-block" aria-labelledby="bi-budget-heading">
                        <h2 id="bi-budget-heading" className="bi-form-block__title mb-1.5">
                          {buyerIntakeBudgetHeading(transactionType)}
                        </h2>
                        <div className="bi-budget-grid grid grid-cols-3 gap-1 sm:gap-1.5">
                          {budgetOptions.map((option) => (
                            <ChoiceChip
                              key={option.value}
                              label={option.label}
                              active={budgetMax === option.value}
                              disabled={submitting}
                              fill
                              onSelect={() => {
                                setBudgetMax(option.value);
                                setStep2Saved(false);
                              }}
                            />
                          ))}
                        </div>
                      </section>

                      {showArea || showRooms ? (
                        <div className={`grid shrink-0 gap-2 ${showArea && showRooms ? 'grid-cols-2' : 'grid-cols-1'}`}>
                          {showArea ? (
                            <section className="bi-form-block" aria-labelledby="bi-area-heading">
                              <div className="mb-1.5">
                                <h2 id="bi-area-heading" className="bi-form-block__title">
                                  {getBuyerAreaHeading(propertyType)}
                                </h2>
                                <p className="bi-form-block__hint mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                                  {getBuyerAreaHint(propertyType)}
                                </p>
                              </div>
                              <p className="bi-form-block__hint mb-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                Od
                              </p>
                              <div className="bi-metric-grid grid grid-cols-3 gap-1">
                                {areaMinOptions.map((value) => (
                                  <ChoiceChip
                                    key={`min-${value}`}
                                    label={`${value} m²`}
                                    active={minArea === value}
                                    disabled={submitting}
                                    compact
                                    fill
                                    onSelect={() => {
                                      const nextMin = minArea === value ? null : value;
                                      setMinArea(nextMin);
                                      if (nextMin != null && maxArea != null && maxArea < nextMin) {
                                        setMaxArea(null);
                                      }
                                      setStep2Saved(false);
                                      setError('');
                                    }}
                                  />
                                ))}
                              </div>
                              <p className="bi-form-block__hint mb-1 mt-1.5 text-[9px] font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">
                                Do
                              </p>
                              <div className="bi-metric-grid grid grid-cols-3 gap-1">
                                {maxAreaOptions.map((value) => (
                                  <ChoiceChip
                                    key={`max-${value}`}
                                    label={`${value} m²`}
                                    active={maxArea === value}
                                    disabled={submitting}
                                    compact
                                    fill
                                    onSelect={() => {
                                      setMaxArea(maxArea === value ? null : value);
                                      setStep2Saved(false);
                                      setError('');
                                    }}
                                  />
                                ))}
                              </div>
                            </section>
                          ) : null}

                          {showRooms ? (
                            <section className="bi-form-block" aria-labelledby="bi-rooms-heading">
                              <div className="mb-1.5">
                                <h2 id="bi-rooms-heading" className="bi-form-block__title">
                                  Pokoje
                                </h2>
                                <p className="bi-form-block__hint mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                                  Zaznacz kilka — np. 2 i 3 pokoje
                                </p>
                              </div>
                              <div className="bi-rooms-grid grid grid-cols-5 gap-1">
                                {BUYER_ROOM_OPTIONS.map((value) => (
                                  <ChoiceChip
                                    key={value}
                                    label={value >= 5 ? '5+' : String(value)}
                                    active={rooms.includes(value)}
                                    disabled={submitting}
                                    compact
                                    fill
                                    onSelect={() => toggleRoom(value)}
                                  />
                                ))}
                              </div>
                            </section>
                          ) : null}
                        </div>
                      ) : null}

                      {step2Summary.length > 0 ? (
                        <p className="bi-live-summary truncate text-center text-[11px] font-medium sm:text-xs">
                          {step2Summary.join(' · ')}
                        </p>
                      ) : null}
                    </div>
                </>
              </motion.div>
            ) : uiStep === 3 ? (
              <motion.div
                key="step3"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <>
                  <section className="shrink-0">
                    <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                      <span className="bi-transaction-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                        {transactionLabel}
                      </span>
                      {selectedLabel ? (
                        <span className="bi-property-pill inline-flex items-center rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-[0.12em]">
                          {BUYER_PROPERTY_OPTIONS.find((o) => o.id === propertyType)?.emoji} {selectedLabel}
                        </span>
                      ) : null}
                    </div>
                    <h1 className="text-[1.35rem] font-semibold leading-[1.08] tracking-[-0.03em] text-slate-900 dark:text-white sm:text-[1.75rem]">
                      Co musi{' '}
                      <span className="bg-gradient-to-r from-emerald-600 to-emerald-400 bg-clip-text text-transparent dark:from-emerald-300 dark:to-emerald-500">
                        być?
                      </span>
                    </h1>
                    <p className="mt-1 text-[13px] leading-snug text-slate-600 dark:text-slate-300">
                      Zaznacz must-have — reszta jest opcjonalna.
                    </p>
                  </section>

                  <div className="mt-2 shrink-0 space-y-2 pb-1 sm:mt-2.5 sm:space-y-2.5">
                    {showAmenities ? (
                      <section className="bi-form-block" aria-labelledby="bi-musthave-heading">
                        <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <h2 id="bi-musthave-heading" className="bi-form-block__title">
                              Must-have
                            </h2>
                            <p className="bi-form-block__hint mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                              Zaznacz wszystko, czego nie odpuszczasz
                            </p>
                          </div>
                          {selectedMustHaves.length > 0 ? (
                            <span className="bi-must-have-count rounded-full px-2 py-0.5 text-[10px] font-bold">
                              {selectedMustHaves.length} wybrane
                            </span>
                          ) : null}
                        </div>
                        <div className="bi-must-have-grid grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                          {mustHaveOptions.map((option) => (
                            <MustHaveChip
                              key={option.id}
                              label={option.label}
                              hint={option.hint}
                              active={mustHaveValue(option.id)}
                              disabled={submitting}
                              onSelect={() => toggleMustHave(option.id)}
                            />
                          ))}
                        </div>
                        {selectedMustHaves.length > 0 ? (
                          <p className="bi-must-have-summary mt-1.5 text-[10px] leading-snug">
                            Must-have:{' '}
                            <span className="font-semibold">{selectedMustHaves.join(' · ')}</span>
                          </p>
                        ) : null}
                      </section>
                    ) : null}

                    <section className="bi-form-block" aria-labelledby="bi-timeline-heading">
                      <div className="mb-1.5">
                        <h2 id="bi-timeline-heading" className="bi-form-block__title">
                          {buyerIntakeTimelineHeading(transactionType)}
                        </h2>
                        <p className="bi-form-block__hint mt-0.5 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
                          {buyerIntakeTimelineHint(firstName, transactionType)}
                        </p>
                      </div>
                      <div className="bi-chip-grid grid grid-cols-2 gap-1 sm:grid-cols-4 sm:gap-1.5">
                        {BUYER_TIMELINE_OPTIONS.map((option) => (
                          <ChoiceChip
                            key={option.id}
                            label={option.label}
                            active={purchaseTimeline === option.id}
                            disabled={submitting}
                            compact
                            fill
                            onSelect={() => {
                              setPurchaseTimeline(purchaseTimeline === option.id ? null : option.id);
                              setStep3Saved(false);
                              setError('');
                            }}
                          />
                        ))}
                      </div>
                    </section>

                    {step2Summary.length > 0 ? (
                      <p className="bi-live-summary truncate text-center text-[11px] font-medium sm:text-xs">
                        {step2Summary.join(' · ')}
                        {step3Summary.length ? ` · ${step3Summary.join(' · ')}` : ''}
                      </p>
                    ) : null}
                  </div>
                </>
              </motion.div>
            ) : (
              <motion.div
                key="step4"
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, ease: EASE_OUT }}
                className="flex min-h-0 flex-1 flex-col"
              >
                <BuyerIntakeStep4Contact
                  agentFirstName={firstName}
                  agentDisplayName={agent.displayName}
                  isRent={isRent}
                  transactionLabel={transactionLabel}
                  propertyLabel={
                    selectedLabel
                      ? `${BUYER_PROPERTY_OPTIONS.find((o) => o.id === propertyType)?.emoji ?? ''} ${selectedLabel}`.trim()
                      : undefined
                  }
                  summaryLine={fullSummaryLine}
                  firstName={contactFirstName}
                  lastName={contactLastName}
                  phoneE164={contactPhone}
                  email={contactEmail}
                  consentContact={consentContact}
                  submitting={submitting}
                  saved={step4Saved}
                  phoneStatus={phoneStatus}
                  emailStatus={emailStatus}
                  contactKnownHint={contactKnownHint}
                  onFirstNameChange={(value) => {
                    setContactFirstName(value);
                    setStep4Saved(false);
                    setError('');
                  }}
                  onLastNameChange={(value) => {
                    setContactLastName(value);
                    setStep4Saved(false);
                    setError('');
                  }}
                  onPhoneE164Change={(value) => {
                    setContactPhone(value);
                    setStep4Saved(false);
                    setError('');
                  }}
                  onEmailChange={(value) => {
                    setContactEmail(value);
                    setStep4Saved(false);
                    setError('');
                  }}
                  onEmailBlur={handleContactEmailBlur}
                  onConsentChange={(value) => {
                    setConsentContact(value);
                    setStep4Saved(false);
                    setError('');
                  }}
                />
              </motion.div>
            )}

          {error ? (
            <p className="bi-page__error mt-2 shrink-0 rounded-xl border border-red-500/20 bg-red-500/10 px-3 py-2 text-[12px] text-red-700 dark:text-red-300">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      {(uiStep === 1 || (uiStep === 2 && !step2Saved) || uiStep === 3 || (uiStep === 4 && !step4Saved)) ? (
        <>
          <div className="bi-page__scroll-fade pointer-events-none shrink-0" aria-hidden />
          <footer className="bi-page__footer shrink-0 border-t px-4 pb-[max(0.65rem,env(safe-area-inset-bottom,0px))] pt-2 sm:px-6 sm:pt-2.5">
          <div className="mx-auto w-full max-w-xl">
            {uiStep === 1 ? (
              <>
                <p className={`bi-footer-hint mb-1.5 text-center text-[10px] font-medium ${propertyType ? 'bi-footer-hint--ready' : ''}`}>
                  {propertyType ? 'Gotowe — szukajmy dalej' : 'Kliknij jedną kartę poniżej'}
                </p>
                <motion.button
                  type="button"
                  disabled={!propertyType || submitting}
                  onClick={() => void handleStep1Continue()}
                  whileTap={reduceMotion || !propertyType || submitting ? undefined : { scale: 0.985 }}
                  className="bi-primary-cta flex w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-[14px] font-bold disabled:cursor-not-allowed sm:rounded-[1.1rem] sm:py-3.5 sm:text-[15px]"
                >
                  {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
                  Szukajmy dalej
                  {!submitting ? <ArrowRight className="bi-primary-cta__arrow size-5" /> : null}
                </motion.button>
              </>
            ) : uiStep === 2 ? (
              <>
                <p className={`bi-footer-hint mb-1.5 text-center text-[10px] font-medium ${step2Ready ? 'bi-footer-hint--ready' : ''}`}>
                  {step2Ready
                    ? 'Gotowe — zapisz kryteria'
                    : isRent
                      ? 'Wybierz miasto i czynsz'
                      : 'Wybierz miasto i budżet'}
                </p>
                <motion.button
                  type="button"
                  disabled={!step2Ready || submitting}
                  onClick={() => void handleStep2Continue()}
                  whileTap={reduceMotion || !step2Ready || submitting ? undefined : { scale: 0.985 }}
                  className="bi-primary-cta flex w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-[14px] font-bold disabled:cursor-not-allowed sm:rounded-[1.1rem] sm:py-3.5 sm:text-[15px]"
                >
                  {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
                  Zapisz i dalej
                  {!submitting ? <ArrowRight className="bi-primary-cta__arrow size-5" /> : null}
                </motion.button>
              </>
            ) : uiStep === 3 ? (
              <>
                <p className="bi-footer-hint bi-footer-hint--ready mb-1.5 text-center text-[10px] font-medium">
                  Wszystko opcjonalne — możesz pominąć wybory
                </p>
                <motion.button
                  type="button"
                  disabled={submitting}
                  onClick={() => void handleStep3Continue()}
                  whileTap={reduceMotion || submitting ? undefined : { scale: 0.985 }}
                  className="bi-primary-cta flex w-full items-center justify-center gap-2 rounded-[1rem] px-4 py-3 text-[14px] font-bold disabled:cursor-not-allowed sm:rounded-[1.1rem] sm:py-3.5 sm:text-[15px]"
                >
                  {submitting ? <Loader2 className="size-5 animate-spin" /> : null}
                  Dalej
                  {!submitting ? <ArrowRight className="bi-primary-cta__arrow size-5" /> : null}
                </motion.button>
              </>
            ) : (
              <BuyerIntakeStep4Footer
                ready={step4Ready}
                submitting={submitting}
                hasEmail={Boolean(contactEmail.trim())}
                onSubmit={() => void handleStep4Continue()}
              />
            )}
          </div>
        </footer>
        </>
      ) : null}
    </main>
  );
}
