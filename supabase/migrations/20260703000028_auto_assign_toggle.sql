-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 28: Interruptor Automático/Manual de auto-asignación por empresa.
-- Antes era "siempre activa para todas las empresas" (decisión inicial del
-- usuario) — ahora se puede apagar desde el Dispatch Board si un operador
-- prefiere asignar manualmente. Default TRUE preserva el comportamiento
-- actual para todas las empresas existentes.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.companies
  ADD COLUMN auto_assign_enabled BOOLEAN NOT NULL DEFAULT true;
