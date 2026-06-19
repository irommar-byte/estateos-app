-- Stanowiska: kierownik biura i zastępca (jak Agent, Expert itd.)
ALTER TYPE "AgencyAgentTitle" ADD VALUE IF NOT EXISTS 'KIEROWNIK_BIURO';
ALTER TYPE "AgencyAgentTitle" ADD VALUE IF NOT EXISTS 'ZASTEPCA_KIEROWNIKA';
