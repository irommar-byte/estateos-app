-- Lista klientów agenta: agregacje matchy i ostatnie aktywności bez pełnego skanu.
CREATE INDEX IF NOT EXISTS `AgencyClientMatch_clientId_notifiedAt_idx`
  ON `AgencyClientMatch` (`clientId`, `notifiedAt`);

CREATE INDEX IF NOT EXISTS `AgencyClientActivity_clientId_kind_createdAt_idx`
  ON `AgencyClientActivity` (`clientId`, `kind`, `createdAt`);
