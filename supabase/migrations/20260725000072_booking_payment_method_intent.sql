-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 72: método de pago declarado al reservar (app pasajero)
-- El pasajero elige "Pagar ahora" / "Tarjeta al finalizar" / "Efectivo" en
-- BookingConfirmScreen, ANTES de que empiece el viaje — no como hoy, que el
-- método se descubre recién cuando alguien lo registra manualmente después.
-- 'card' cubre tanto "pagar ahora" (ya se cobró en la creación) como "cobrar
-- al finalizar" (se cobra automático al completar el viaje si no hay ya un
-- pago exitoso, ver autoChargeDeferredCardInBackground en payments.ts).
-- NULL = reservas viejas o del guest checkout de la web, que nunca declaran
-- esto — se tratan igual que siempre (conciliación manual).
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.bookings
  ADD COLUMN payment_method_intent TEXT CHECK (payment_method_intent IN ('card', 'cash'));
