-- MariaDB: rozszerzenie stanowisk agenta (kierownik biura, zastępca)
ALTER TABLE `AgencyCompanyMember`
  MODIFY COLUMN `agentTitle` ENUM(
    'DORADCA',
    'AGENT',
    'BROKER',
    'EXPERT',
    'LEADER',
    'KIEROWNIK_BIURO',
    'ZASTEPCA_KIEROWNIKA'
  ) NOT NULL DEFAULT 'AGENT';
