/**
 * LuxeRide — Local Database type definitions for Supabase client generics.
 *
 * All Insert / Update types are written INLINE (no Partial<Row> helpers)
 * following the exact format of `supabase gen types typescript`.
 * This avoids the never-type resolution failure that occurs when TypeScript
 * evaluates type aliases inside Supabase's deeply-nested generic chain.
 *
 * Keep in sync with supabase/migrations/*.sql
 */

// ─── JSON ──────────────────────────────────────────────────────────────────────

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

// ─── Enum types ────────────────────────────────────────────────────────────────

export type UserRole =
  | 'super_admin'
  | 'company_owner'
  | 'company_admin'
  | 'dispatcher'
  | 'accounting'
  | 'driver'
  | 'customer'
  | 'corporate_manager'
  | 'corporate_user'

export type CompanyStatus = 'active' | 'suspended' | 'trial' | 'cancelled'
export type CompanyPlan = 'free' | 'starter' | 'professional' | 'enterprise'
export type EnterpriseLeadStatus = 'new' | 'contacted' | 'converted' | 'rejected'
export type VehicleClass = 'sedan' | 'suv' | 'van' | 'limousine' | 'sprinter' | 'bus' | 'exotic'
export type VehicleStatus = 'available' | 'on_trip' | 'maintenance' | 'offline' | 'retired'
export type BookingStatus =
  | 'quote'
  | 'pending'
  | 'assigned'
  | 'en_route'
  | 'arrived'
  | 'in_progress'
  | 'completed'
  | 'cancelled'
  | 'no_show'
  | 'failed'
export type BookingType =
  | 'one_way'
  | 'round_trip'
  | 'hourly'
  | 'airport_pickup'
  | 'airport_dropoff'
  | 'point_to_point'
export type PricingModel = 'flat_rate' | 'per_mile' | 'per_km' | 'hourly' | 'zone_based'
export type PaymentStatus =
  | 'pending'
  | 'processing'
  | 'succeeded'
  | 'failed'
  | 'refunded'
  | 'partially_refunded'
  | 'cancelled'
export type PaymentMethodType = 'card' | 'cash' | 'corporate_account' | 'bank_transfer'
export type NotificationChannel = 'email' | 'sms' | 'push' | 'in_app'
export type DocumentType =
  | 'drivers_license'
  | 'vehicle_registration'
  | 'insurance'
  | 'background_check'
  | 'medical_certificate'
  | 'other'

// ─── Database ──────────────────────────────────────────────────────────────────

export type Database = {
  public: {
    Tables: {
      // ── companies ──────────────────────────────────────────────────────────
      companies: {
        Row: {
          id: string
          name: string
          slug: string
          status: CompanyStatus
          plan: CompanyPlan
          logo_url: string | null
          primary_color: string | null
          tagline: string | null
          hero_image_url: string | null
          about: string | null
          phone: string | null
          email: string | null
          address: string | null
          city: string | null
          country: string | null
          timezone: string | null
          currency: string | null
          distance_unit: string | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          stripe_connect_account_id: string | null
          stripe_connect_onboarded: boolean | null
          whop_membership_id: string | null
          whop_plan_id: string | null
          whop_last_event_id: string | null
          whop_connect_company_id: string | null
          whop_connect_onboarded: boolean
          active_payment_provider: string | null
          auto_assign_enabled: boolean
          settings: Json
          trial_ends_at: string | null
          subscription_ends_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          name: string
          slug: string
          status?: CompanyStatus | undefined
          plan?: CompanyPlan | undefined
          logo_url?: string | null | undefined
          primary_color?: string | null | undefined
          tagline?: string | null | undefined
          hero_image_url?: string | null | undefined
          about?: string | null | undefined
          phone?: string | null | undefined
          email?: string | null | undefined
          address?: string | null | undefined
          city?: string | null | undefined
          country?: string | null | undefined
          timezone?: string | null | undefined
          currency?: string | null | undefined
          distance_unit?: string | null | undefined
          stripe_customer_id?: string | null | undefined
          stripe_subscription_id?: string | null | undefined
          stripe_connect_account_id?: string | null | undefined
          stripe_connect_onboarded?: boolean | null | undefined
          whop_membership_id?: string | null | undefined
          whop_plan_id?: string | null | undefined
          whop_last_event_id?: string | null | undefined
          whop_connect_company_id?: string | null | undefined
          whop_connect_onboarded?: boolean | undefined
          active_payment_provider?: string | null | undefined
          auto_assign_enabled?: boolean | undefined
          settings?: Json | undefined
          trial_ends_at?: string | null | undefined
          subscription_ends_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          name?: string | undefined
          slug?: string | undefined
          status?: CompanyStatus | undefined
          plan?: CompanyPlan | undefined
          logo_url?: string | null | undefined
          primary_color?: string | null | undefined
          tagline?: string | null | undefined
          hero_image_url?: string | null | undefined
          about?: string | null | undefined
          phone?: string | null | undefined
          email?: string | null | undefined
          address?: string | null | undefined
          city?: string | null | undefined
          country?: string | null | undefined
          timezone?: string | null | undefined
          currency?: string | null | undefined
          distance_unit?: string | null | undefined
          stripe_customer_id?: string | null | undefined
          stripe_subscription_id?: string | null | undefined
          stripe_connect_account_id?: string | null | undefined
          stripe_connect_onboarded?: boolean | null | undefined
          whop_membership_id?: string | null | undefined
          whop_plan_id?: string | null | undefined
          whop_last_event_id?: string | null | undefined
          whop_connect_company_id?: string | null | undefined
          whop_connect_onboarded?: boolean | undefined
          active_payment_provider?: string | null | undefined
          auto_assign_enabled?: boolean | undefined
          settings?: Json | undefined
          trial_ends_at?: string | null | undefined
          subscription_ends_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── user_profiles ───────────────────────────────────────────────────────
      user_profiles: {
        Row: {
          id: string
          company_id: string
          role: UserRole
          first_name: string
          last_name: string
          phone: string | null
          avatar_url: string | null
          is_active: boolean
          last_seen_at: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id: string
          role?: UserRole | undefined
          first_name: string
          last_name: string
          phone?: string | null | undefined
          avatar_url?: string | null | undefined
          is_active?: boolean | undefined
          last_seen_at?: string | null | undefined
          metadata?: Json | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          role?: UserRole | undefined
          first_name?: string | undefined
          last_name?: string | undefined
          phone?: string | null | undefined
          avatar_url?: string | null | undefined
          is_active?: boolean | undefined
          last_seen_at?: string | null | undefined
          metadata?: Json | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── vehicle_types ───────────────────────────────────────────────────────
      vehicle_types: {
        Row: {
          id: string
          company_id: string
          name: string
          class: VehicleClass
          capacity: number
          amenities: string[]
          base_image_url: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          name: string
          class: VehicleClass
          capacity?: number | undefined
          amenities?: string[] | undefined
          base_image_url?: string | null | undefined
          sort_order?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          name?: string | undefined
          class?: VehicleClass | undefined
          capacity?: number | undefined
          amenities?: string[] | undefined
          base_image_url?: string | null | undefined
          sort_order?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── vehicles ────────────────────────────────────────────────────────────
      vehicles: {
        Row: {
          id: string
          company_id: string
          vehicle_type_id: string | null
          make: string
          model: string
          year: number
          color: string | null
          plate_number: string
          vin: string | null
          status: VehicleStatus
          current_driver_id: string | null
          mileage: number | null
          last_maintenance_at: string | null
          next_maintenance_at: string | null
          insurance_expires_at: string | null
          notes: string | null
          metadata: Json
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          vehicle_type_id?: string | null | undefined
          make: string
          model: string
          year: number
          color?: string | null | undefined
          plate_number: string
          vin?: string | null | undefined
          status?: VehicleStatus | undefined
          current_driver_id?: string | null | undefined
          mileage?: number | null | undefined
          last_maintenance_at?: string | null | undefined
          next_maintenance_at?: string | null | undefined
          insurance_expires_at?: string | null | undefined
          notes?: string | null | undefined
          metadata?: Json | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          vehicle_type_id?: string | null | undefined
          make?: string | undefined
          model?: string | undefined
          year?: number | undefined
          color?: string | null | undefined
          plate_number?: string | undefined
          vin?: string | null | undefined
          status?: VehicleStatus | undefined
          current_driver_id?: string | null | undefined
          mileage?: number | null | undefined
          last_maintenance_at?: string | null | undefined
          next_maintenance_at?: string | null | undefined
          insurance_expires_at?: string | null | undefined
          notes?: string | null | undefined
          metadata?: Json | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── drivers ─────────────────────────────────────────────────────────────
      drivers: {
        Row: {
          id: string
          company_id: string
          license_number: string | null
          license_expiry: string | null
          license_state: string | null
          current_vehicle_id: string | null
          is_available: boolean
          rating: number | null
          total_trips: number
          total_earnings: number
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          company_id: string
          license_number?: string | null | undefined
          license_expiry?: string | null | undefined
          license_state?: string | null | undefined
          current_vehicle_id?: string | null | undefined
          is_available?: boolean | undefined
          rating?: number | null | undefined
          total_trips?: number | undefined
          total_earnings?: number | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          license_number?: string | null | undefined
          license_expiry?: string | null | undefined
          license_state?: string | null | undefined
          current_vehicle_id?: string | null | undefined
          is_available?: boolean | undefined
          rating?: number | null | undefined
          total_trips?: number | undefined
          total_earnings?: number | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── maintenance_records ─────────────────────────────────────────────────
      maintenance_records: {
        Row: {
          id: string
          company_id: string
          vehicle_id: string
          type: string
          description: string | null
          cost: number | null
          mileage_at_service: number | null
          performed_at: string
          next_due_at: string | null
          technician: string | null
          shop_name: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          vehicle_id: string
          type: string
          description?: string | null | undefined
          cost?: number | null | undefined
          mileage_at_service?: number | null | undefined
          performed_at: string
          next_due_at?: string | null | undefined
          technician?: string | null | undefined
          shop_name?: string | null | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          vehicle_id?: string | undefined
          type?: string | undefined
          description?: string | null | undefined
          cost?: number | null | undefined
          mileage_at_service?: number | null | undefined
          performed_at?: string | undefined
          next_due_at?: string | null | undefined
          technician?: string | null | undefined
          shop_name?: string | null | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── company_services (microsite del operador) ────────────────────────────
      company_services: {
        Row: {
          id: string
          company_id: string
          title: string
          description: string | null
          icon: string | null
          image_url: string | null
          i18n: Json | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          title: string
          description?: string | null | undefined
          icon?: string | null | undefined
          image_url?: string | null | undefined
          i18n?: Json | null | undefined
          sort_order?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          title?: string | undefined
          description?: string | null | undefined
          icon?: string | null | undefined
          image_url?: string | null | undefined
          i18n?: Json | null | undefined
          sort_order?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── trip_messages ───────────────────────────────────────────────────────
      trip_messages: {
        Row: {
          id: string
          booking_id: string
          company_id: string
          sender: 'client' | 'driver'
          body: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          booking_id: string
          company_id: string
          sender: 'client' | 'driver'
          body: string
          read_at?: string | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          booking_id?: string | undefined
          company_id?: string | undefined
          sender?: 'client' | 'driver' | undefined
          body?: string | undefined
          read_at?: string | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── trip_reports ────────────────────────────────────────────────────────
      trip_reports: {
        Row: {
          id: string
          booking_id: string
          company_id: string
          driver_id: string | null
          category: string
          reason: string
          resolved_at: string | null
          resolved_by: string | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          booking_id: string
          company_id: string
          driver_id?: string | null | undefined
          category?: string | undefined
          reason: string
          resolved_at?: string | null | undefined
          resolved_by?: string | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          booking_id?: string | undefined
          company_id?: string | undefined
          driver_id?: string | null | undefined
          category?: string | undefined
          reason?: string | undefined
          resolved_at?: string | null | undefined
          resolved_by?: string | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── enterprise_leads (venta consultiva del plan Enterprise) ───────────────
      enterprise_leads: {
        Row: {
          id: string
          company_id: string | null
          requested_by: string | null
          company_name: string
          contact_name: string
          email: string
          phone: string
          fleet_size: string | null
          message: string | null
          status: EnterpriseLeadStatus
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id?: string | null | undefined
          requested_by?: string | null | undefined
          company_name: string
          contact_name: string
          email: string
          phone: string
          fleet_size?: string | null | undefined
          message?: string | null | undefined
          status?: EnterpriseLeadStatus | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | null | undefined
          requested_by?: string | null | undefined
          company_name?: string | undefined
          contact_name?: string | undefined
          email?: string | undefined
          phone?: string | undefined
          fleet_size?: string | null | undefined
          message?: string | null | undefined
          status?: EnterpriseLeadStatus | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── booking_events (bitácora: rechazos, incidentes, reasignaciones) ───────
      booking_events: {
        Row: {
          id: string
          booking_id: string
          company_id: string
          type: string
          actor: string
          actor_id: string | null
          reason: string | null
          metadata: Json
          created_at: string
        }
        Insert: {
          id?: string | undefined
          booking_id: string
          company_id: string
          type: string
          actor: string
          actor_id?: string | null | undefined
          reason?: string | null | undefined
          metadata?: Json | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          booking_id?: string | undefined
          company_id?: string | undefined
          type?: string | undefined
          actor?: string | undefined
          actor_id?: string | null | undefined
          reason?: string | null | undefined
          metadata?: Json | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── driver_messages (chat Dispatch ↔ Conductor, canal general) ────────────
      driver_messages: {
        Row: {
          id: string
          company_id: string
          driver_id: string
          sender: 'dispatch' | 'driver'
          sender_name: string | null
          body: string
          read_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          driver_id: string
          sender: 'dispatch' | 'driver'
          sender_name?: string | null | undefined
          body: string
          read_at?: string | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          driver_id?: string | undefined
          sender?: 'dispatch' | 'driver' | undefined
          sender_name?: string | null | undefined
          body?: string | undefined
          read_at?: string | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── trip_locations (tracking en vivo) ─────────────────────────────────────
      trip_locations: {
        Row: {
          id: string
          booking_id: string
          company_id: string
          reporter: 'driver' | 'passenger'
          latitude: number
          longitude: number
          recorded_at: string
        }
        Insert: {
          id?: string | undefined
          booking_id: string
          company_id: string
          reporter: 'driver' | 'passenger'
          latitude: number
          longitude: number
          recorded_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          booking_id?: string | undefined
          company_id?: string | undefined
          reporter?: 'driver' | 'passenger' | undefined
          latitude?: number | undefined
          longitude?: number | undefined
          recorded_at?: string | undefined
        }
        Relationships: []
      }

      // ── plan_quotas (cuota de tracking en vivo + precio mensual por plan) ─────
      plan_quotas: {
        Row: {
          plan: 'free' | 'starter' | 'professional' | 'enterprise'
          live_tracking_monthly_quota: number | null
          monthly_price: number
          updated_at: string
        }
        Insert: {
          plan: 'free' | 'starter' | 'professional' | 'enterprise'
          live_tracking_monthly_quota?: number | null | undefined
          monthly_price?: number | undefined
          updated_at?: string | undefined
        }
        Update: {
          plan?: 'free' | 'starter' | 'professional' | 'enterprise' | undefined
          live_tracking_monthly_quota?: number | null | undefined
          monthly_price?: number | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── live_tracking_usage (consumo mensual por empresa) ─────────────────────
      live_tracking_usage: {
        Row: {
          company_id: string
          year_month: string
          refresh_count: number
          updated_at: string
        }
        Insert: {
          company_id: string
          year_month: string
          refresh_count?: number | undefined
          updated_at?: string | undefined
        }
        Update: {
          company_id?: string | undefined
          year_month?: string | undefined
          refresh_count?: number | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── live_tracking_usage_by_booking (consumo de mapa por viaje) ────────────
      live_tracking_usage_by_booking: {
        Row: {
          booking_id: string
          company_id: string
          year_month: string
          refresh_count: number
          updated_at: string
        }
        Insert: {
          booking_id: string
          company_id: string
          year_month: string
          refresh_count?: number | undefined
          updated_at?: string | undefined
        }
        Update: {
          booking_id?: string | undefined
          company_id?: string | undefined
          year_month?: string | undefined
          refresh_count?: number | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── service_zones ───────────────────────────────────────────────────────
      service_zones: {
        Row: {
          id: string
          company_id: string
          name: string
          type: string
          geometry: Json | null
          center_lat: number | null
          center_lng: number | null
          radius_miles: number | null
          postal_codes: string[]
          color: string | null
          sort_order: number
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          name: string
          type?: string | undefined
          geometry?: Json | null | undefined
          center_lat?: number | null | undefined
          center_lng?: number | null | undefined
          radius_miles?: number | null | undefined
          postal_codes?: string[] | undefined
          color?: string | null | undefined
          sort_order?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          name?: string | undefined
          type?: string | undefined
          geometry?: Json | null | undefined
          center_lat?: number | null | undefined
          center_lng?: number | null | undefined
          radius_miles?: number | null | undefined
          postal_codes?: string[] | undefined
          color?: string | null | undefined
          sort_order?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── airports ────────────────────────────────────────────────────────────
      airports: {
        Row: {
          id: string
          iata_code: string
          icao_code: string | null
          name: string
          city: string
          state: string | null
          country: string
          lat: number | null
          lng: number | null
          terminal_count: number | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string | undefined
          iata_code: string
          icao_code?: string | null | undefined
          name: string
          city: string
          state?: string | null | undefined
          country?: string | undefined
          lat?: number | null | undefined
          lng?: number | null | undefined
          terminal_count?: number | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          iata_code?: string | undefined
          icao_code?: string | null | undefined
          name?: string | undefined
          city?: string | undefined
          state?: string | null | undefined
          country?: string | undefined
          lat?: number | null | undefined
          lng?: number | null | undefined
          terminal_count?: number | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── company_airports ────────────────────────────────────────────────────
      company_airports: {
        Row: {
          id: string
          company_id: string
          airport_id: string
          pickup_fee: number
          dropoff_fee: number
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          airport_id: string
          pickup_fee?: number | undefined
          dropoff_fee?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          airport_id?: string | undefined
          pickup_fee?: number | undefined
          dropoff_fee?: number | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── pricing_rules ───────────────────────────────────────────────────────
      pricing_rules: {
        Row: {
          id: string
          company_id: string
          vehicle_type_id: string | null
          name: string
          model: PricingModel
          base_price: number
          per_mile_rate: number | null
          per_km_rate: number | null
          hourly_rate: number | null
          minimum_fare: number | null
          origin_zone_id: string | null
          destination_zone_id: string | null
          airport_pickup_fee: number | null
          airport_dropoff_fee: number | null
          night_surcharge_pct: number | null
          weekend_surcharge_pct: number | null
          holiday_surcharge_pct: number | null
          surge_enabled: boolean | null
          surge_multiplier: number | null
          valid_from: string | null
          valid_until: string | null
          days_of_week: number[] | null
          priority: number | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          vehicle_type_id?: string | null | undefined
          name: string
          model: PricingModel
          base_price?: number | undefined
          per_mile_rate?: number | null | undefined
          per_km_rate?: number | null | undefined
          hourly_rate?: number | null | undefined
          minimum_fare?: number | null | undefined
          origin_zone_id?: string | null | undefined
          destination_zone_id?: string | null | undefined
          airport_pickup_fee?: number | null | undefined
          airport_dropoff_fee?: number | null | undefined
          night_surcharge_pct?: number | null | undefined
          weekend_surcharge_pct?: number | null | undefined
          holiday_surcharge_pct?: number | null | undefined
          surge_enabled?: boolean | null | undefined
          surge_multiplier?: number | null | undefined
          valid_from?: string | null | undefined
          valid_until?: string | null | undefined
          days_of_week?: number[] | null | undefined
          priority?: number | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          vehicle_type_id?: string | null | undefined
          name?: string | undefined
          model?: PricingModel | undefined
          base_price?: number | undefined
          per_mile_rate?: number | null | undefined
          per_km_rate?: number | null | undefined
          hourly_rate?: number | null | undefined
          minimum_fare?: number | null | undefined
          origin_zone_id?: string | null | undefined
          destination_zone_id?: string | null | undefined
          airport_pickup_fee?: number | null | undefined
          airport_dropoff_fee?: number | null | undefined
          night_surcharge_pct?: number | null | undefined
          weekend_surcharge_pct?: number | null | undefined
          holiday_surcharge_pct?: number | null | undefined
          surge_enabled?: boolean | null | undefined
          surge_multiplier?: number | null | undefined
          valid_from?: string | null | undefined
          valid_until?: string | null | undefined
          days_of_week?: number[] | null | undefined
          priority?: number | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── price_quotes ────────────────────────────────────────────────────────
      price_quotes: {
        Row: {
          id: string
          company_id: string
          pricing_rule_id: string | null
          vehicle_type_id: string | null
          pickup_lat: number | null
          pickup_lng: number | null
          pickup_address: string | null
          dropoff_lat: number | null
          dropoff_lng: number | null
          dropoff_address: string | null
          distance_miles: number | null
          duration_minutes: number | null
          route_polyline: string | null
          base_amount: number
          surcharge_amount: number | null
          tax_amount: number | null
          total_amount: number
          currency: string | null
          expires_at: string
          is_used: boolean | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          pricing_rule_id?: string | null | undefined
          vehicle_type_id?: string | null | undefined
          pickup_lat?: number | null | undefined
          pickup_lng?: number | null | undefined
          pickup_address?: string | null | undefined
          dropoff_lat?: number | null | undefined
          dropoff_lng?: number | null | undefined
          dropoff_address?: string | null | undefined
          distance_miles?: number | null | undefined
          duration_minutes?: number | null | undefined
          route_polyline?: string | null | undefined
          base_amount: number
          surcharge_amount?: number | null | undefined
          tax_amount?: number | null | undefined
          total_amount: number
          currency?: string | null | undefined
          expires_at?: string | undefined
          is_used?: boolean | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          pricing_rule_id?: string | null | undefined
          vehicle_type_id?: string | null | undefined
          pickup_lat?: number | null | undefined
          pickup_lng?: number | null | undefined
          pickup_address?: string | null | undefined
          dropoff_lat?: number | null | undefined
          dropoff_lng?: number | null | undefined
          dropoff_address?: string | null | undefined
          distance_miles?: number | null | undefined
          duration_minutes?: number | null | undefined
          route_polyline?: string | null | undefined
          base_amount?: number | undefined
          surcharge_amount?: number | null | undefined
          tax_amount?: number | null | undefined
          total_amount?: number | undefined
          currency?: string | null | undefined
          expires_at?: string | undefined
          is_used?: boolean | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── bookings ────────────────────────────────────────────────────────────
      bookings: {
        Row: {
          id: string
          company_id: string
          booking_number: string
          status: BookingStatus
          type: BookingType
          customer_id: string | null
          driver_id: string | null
          vehicle_id: string | null
          vehicle_type_id: string | null
          corporate_account_id: string | null
          passenger_count: number
          passenger_name: string | null
          passenger_phone: string | null
          passenger_email: string | null
          pickup_location: Json
          dropoff_location: Json
          waypoints: Json[] | null
          scheduled_at: string
          flight_number: string | null
          flight_arrival_at: string | null
          flight_status: string | null
          flight_delay_minutes: number | null
          flight_checked_at: string | null
          meet_and_greet: boolean | null
          sign_name: string | null
          dispatched_at: string | null
          en_route_at: string | null
          arrived_at: string | null
          started_at: string | null
          completed_at: string | null
          cancelled_at: string | null
          no_show_at: string | null
          distance_miles: number | null
          duration_minutes: number | null
          actual_distance_miles: number | null
          actual_duration_minutes: number | null
          route_polyline: string | null
          price_quote_id: string | null
          base_amount: number | null
          total_amount: number | null
          currency: string | null
          gratuity_amount: number | null
          gratuity_pct: number | null
          special_instructions: string | null
          internal_notes: string | null
          cancellation_reason: string | null
          cancelled_by: string | null
          rating: number | null
          rating_comment: string | null
          rated_at: string | null
          driver_rating: number | null
          driver_rating_comment: string | null
          driver_rated_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          booking_number?: string | undefined
          status?: BookingStatus | undefined
          type?: BookingType | undefined
          customer_id?: string | null | undefined
          driver_id?: string | null | undefined
          vehicle_id?: string | null | undefined
          vehicle_type_id?: string | null | undefined
          corporate_account_id?: string | null | undefined
          passenger_count?: number | undefined
          passenger_name?: string | null | undefined
          passenger_phone?: string | null | undefined
          passenger_email?: string | null | undefined
          pickup_location: Json
          dropoff_location: Json
          waypoints?: Json[] | null | undefined
          scheduled_at: string
          flight_number?: string | null | undefined
          flight_arrival_at?: string | null | undefined
          flight_status?: string | null | undefined
          flight_delay_minutes?: number | null | undefined
          flight_checked_at?: string | null | undefined
          meet_and_greet?: boolean | null | undefined
          sign_name?: string | null | undefined
          dispatched_at?: string | null | undefined
          en_route_at?: string | null | undefined
          arrived_at?: string | null | undefined
          started_at?: string | null | undefined
          completed_at?: string | null | undefined
          cancelled_at?: string | null | undefined
          no_show_at?: string | null | undefined
          distance_miles?: number | null | undefined
          duration_minutes?: number | null | undefined
          actual_distance_miles?: number | null | undefined
          actual_duration_minutes?: number | null | undefined
          route_polyline?: string | null | undefined
          price_quote_id?: string | null | undefined
          base_amount?: number | null | undefined
          total_amount?: number | null | undefined
          currency?: string | null | undefined
          gratuity_amount?: number | null | undefined
          gratuity_pct?: number | null | undefined
          special_instructions?: string | null | undefined
          internal_notes?: string | null | undefined
          cancellation_reason?: string | null | undefined
          cancelled_by?: string | null | undefined
          rating?: number | null | undefined
          rating_comment?: string | null | undefined
          rated_at?: string | null | undefined
          driver_rating?: number | null | undefined
          driver_rating_comment?: string | null | undefined
          driver_rated_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          booking_number?: string | undefined
          status?: BookingStatus | undefined
          type?: BookingType | undefined
          customer_id?: string | null | undefined
          driver_id?: string | null | undefined
          vehicle_id?: string | null | undefined
          vehicle_type_id?: string | null | undefined
          corporate_account_id?: string | null | undefined
          passenger_count?: number | undefined
          passenger_name?: string | null | undefined
          passenger_phone?: string | null | undefined
          passenger_email?: string | null | undefined
          pickup_location?: Json | undefined
          dropoff_location?: Json | undefined
          waypoints?: Json[] | null | undefined
          scheduled_at?: string | undefined
          flight_number?: string | null | undefined
          flight_arrival_at?: string | null | undefined
          flight_status?: string | null | undefined
          flight_delay_minutes?: number | null | undefined
          flight_checked_at?: string | null | undefined
          meet_and_greet?: boolean | null | undefined
          sign_name?: string | null | undefined
          dispatched_at?: string | null | undefined
          en_route_at?: string | null | undefined
          arrived_at?: string | null | undefined
          started_at?: string | null | undefined
          completed_at?: string | null | undefined
          cancelled_at?: string | null | undefined
          no_show_at?: string | null | undefined
          distance_miles?: number | null | undefined
          duration_minutes?: number | null | undefined
          actual_distance_miles?: number | null | undefined
          actual_duration_minutes?: number | null | undefined
          route_polyline?: string | null | undefined
          price_quote_id?: string | null | undefined
          base_amount?: number | null | undefined
          total_amount?: number | null | undefined
          currency?: string | null | undefined
          gratuity_amount?: number | null | undefined
          gratuity_pct?: number | null | undefined
          special_instructions?: string | null | undefined
          internal_notes?: string | null | undefined
          cancellation_reason?: string | null | undefined
          cancelled_by?: string | null | undefined
          rating?: number | null | undefined
          rating_comment?: string | null | undefined
          rated_at?: string | null | undefined
          driver_rating?: number | null | undefined
          driver_rating_comment?: string | null | undefined
          driver_rated_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── booking_fees ────────────────────────────────────────────────────────
      booking_fees: {
        Row: {
          id: string
          booking_id: string
          company_id: string
          type: string
          description: string | null
          amount: number
          created_at: string
        }
        Insert: {
          id?: string | undefined
          booking_id: string
          company_id: string
          type: string
          description?: string | null | undefined
          amount: number
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          booking_id?: string | undefined
          company_id?: string | undefined
          type?: string | undefined
          description?: string | null | undefined
          amount?: number | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── passenger_whop_members ───────────────────────────────────────────────
      // Vincula pasajero (por teléfono) ↔ member de Whop de esa empresa, para
      // reusar su tarjeta guardada en la próxima reserva (Sección I, capa 3).
      passenger_whop_members: {
        Row: {
          id: string
          company_id: string
          phone: string
          whop_member_id: string
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          phone: string
          whop_member_id: string
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          phone?: string | undefined
          whop_member_id?: string | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── booking_extras ──────────────────────────────────────────────────────
      booking_extras: {
        Row: {
          id: string
          booking_id: string
          company_id: string
          name: string
          quantity: number | null
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string | undefined
          booking_id: string
          company_id: string
          name: string
          quantity?: number | null | undefined
          unit_price: number
          total_price: number
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          booking_id?: string | undefined
          company_id?: string | undefined
          name?: string | undefined
          quantity?: number | null | undefined
          unit_price?: number | undefined
          total_price?: number | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── payments ────────────────────────────────────────────────────────────
      payments: {
        Row: {
          id: string
          company_id: string
          booking_id: string | null
          customer_id: string | null
          stripe_payment_intent_id: string | null
          stripe_charge_id: string | null
          stripe_connect_account_id: string | null
          whop_checkout_id: string | null
          whop_payment_id: string | null
          amount: number
          currency: string
          platform_fee: number | null
          net_amount: number | null
          status: PaymentStatus
          payment_method: PaymentMethodType
          stripe_payment_method_id: string | null
          description: string | null
          metadata: Json
          failure_code: string | null
          failure_message: string | null
          captured_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          booking_id?: string | null | undefined
          customer_id?: string | null | undefined
          stripe_payment_intent_id?: string | null | undefined
          stripe_charge_id?: string | null | undefined
          stripe_connect_account_id?: string | null | undefined
          whop_checkout_id?: string | null | undefined
          whop_payment_id?: string | null | undefined
          amount: number
          currency?: string | undefined
          platform_fee?: number | null | undefined
          net_amount?: number | null | undefined
          status?: PaymentStatus | undefined
          payment_method?: PaymentMethodType | undefined
          stripe_payment_method_id?: string | null | undefined
          description?: string | null | undefined
          metadata?: Json | undefined
          failure_code?: string | null | undefined
          failure_message?: string | null | undefined
          captured_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          booking_id?: string | null | undefined
          customer_id?: string | null | undefined
          stripe_payment_intent_id?: string | null | undefined
          stripe_charge_id?: string | null | undefined
          stripe_connect_account_id?: string | null | undefined
          whop_checkout_id?: string | null | undefined
          whop_payment_id?: string | null | undefined
          amount?: number | undefined
          currency?: string | undefined
          platform_fee?: number | null | undefined
          net_amount?: number | null | undefined
          status?: PaymentStatus | undefined
          payment_method?: PaymentMethodType | undefined
          stripe_payment_method_id?: string | null | undefined
          description?: string | null | undefined
          metadata?: Json | undefined
          failure_code?: string | null | undefined
          failure_message?: string | null | undefined
          captured_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── refunds ─────────────────────────────────────────────────────────────
      refunds: {
        Row: {
          id: string
          company_id: string
          payment_id: string
          booking_id: string | null
          stripe_refund_id: string | null
          whop_refund_id: string | null
          amount: number
          reason: string | null
          status: string
          initiated_by: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          payment_id: string
          booking_id?: string | null | undefined
          stripe_refund_id?: string | null | undefined
          whop_refund_id?: string | null | undefined
          amount: number
          reason?: string | null | undefined
          status?: string | undefined
          initiated_by?: string | null | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          payment_id?: string | undefined
          booking_id?: string | null | undefined
          stripe_refund_id?: string | null | undefined
          whop_refund_id?: string | null | undefined
          amount?: number | undefined
          reason?: string | null | undefined
          status?: string | undefined
          initiated_by?: string | null | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── invoices ────────────────────────────────────────────────────────────
      invoices: {
        Row: {
          id: string
          company_id: string
          customer_id: string | null
          corporate_account_id: string | null
          invoice_number: string
          status: string
          subtotal: number
          tax_amount: number | null
          discount_amount: number | null
          total_amount: number
          currency: string | null
          notes: string | null
          due_date: string | null
          sent_at: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          customer_id?: string | null | undefined
          corporate_account_id?: string | null | undefined
          invoice_number?: string | undefined
          status?: string | undefined
          subtotal?: number | undefined
          tax_amount?: number | null | undefined
          discount_amount?: number | null | undefined
          total_amount?: number | undefined
          currency?: string | null | undefined
          notes?: string | null | undefined
          due_date?: string | null | undefined
          sent_at?: string | null | undefined
          paid_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          customer_id?: string | null | undefined
          corporate_account_id?: string | null | undefined
          invoice_number?: string | undefined
          status?: string | undefined
          subtotal?: number | undefined
          tax_amount?: number | null | undefined
          discount_amount?: number | null | undefined
          total_amount?: number | undefined
          currency?: string | null | undefined
          notes?: string | null | undefined
          due_date?: string | null | undefined
          sent_at?: string | null | undefined
          paid_at?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── invoice_line_items ──────────────────────────────────────────────────
      invoice_line_items: {
        Row: {
          id: string
          invoice_id: string
          booking_id: string | null
          description: string
          quantity: number | null
          unit_price: number
          total_price: number
          created_at: string
        }
        Insert: {
          id?: string | undefined
          invoice_id: string
          booking_id?: string | null | undefined
          description: string
          quantity?: number | null | undefined
          unit_price: number
          total_price: number
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          invoice_id?: string | undefined
          booking_id?: string | null | undefined
          description?: string | undefined
          quantity?: number | null | undefined
          unit_price?: number | undefined
          total_price?: number | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── corporate_accounts (stub) ───────────────────────────────────────────
      corporate_accounts: {
        Row: {
          id: string
          company_id: string
          name: string
          contact_name: string | null
          contact_email: string | null
          billing_email: string | null
          phone: string | null
          address: string | null
          tax_id: string | null
          credit_limit: number | null
          current_balance: number | null
          payment_terms: number | null
          billing_cycle: string | null
          require_approval: boolean | null
          approval_threshold: number | null
          allow_personal_trips: boolean | null
          cost_center_required: boolean | null
          stripe_customer_id: string | null
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          name: string
          contact_name?: string | null | undefined
          contact_email?: string | null | undefined
          billing_email?: string | null | undefined
          phone?: string | null | undefined
          address?: string | null | undefined
          tax_id?: string | null | undefined
          credit_limit?: number | null | undefined
          current_balance?: number | null | undefined
          payment_terms?: number | null | undefined
          billing_cycle?: string | null | undefined
          require_approval?: boolean | null | undefined
          approval_threshold?: number | null | undefined
          allow_personal_trips?: boolean | null | undefined
          cost_center_required?: boolean | null | undefined
          stripe_customer_id?: string | null | undefined
          notes?: string | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          name?: string | undefined
          contact_name?: string | null | undefined
          contact_email?: string | null | undefined
          billing_email?: string | null | undefined
          phone?: string | null | undefined
          address?: string | null | undefined
          tax_id?: string | null | undefined
          credit_limit?: number | null | undefined
          current_balance?: number | null | undefined
          payment_terms?: number | null | undefined
          billing_cycle?: string | null | undefined
          require_approval?: boolean | null | undefined
          approval_threshold?: number | null | undefined
          allow_personal_trips?: boolean | null | undefined
          cost_center_required?: boolean | null | undefined
          stripe_customer_id?: string | null | undefined
          notes?: string | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── corporate_members ───────────────────────────────────────────────────
      corporate_members: {
        Row: {
          id: string
          company_id: string
          corporate_account_id: string
          user_id: string
          role: string
          spending_limit: number | null
          monthly_limit: number | null
          cost_center: string | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          corporate_account_id: string
          user_id: string
          role?: string | undefined
          spending_limit?: number | null | undefined
          monthly_limit?: number | null | undefined
          cost_center?: string | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          corporate_account_id?: string | undefined
          user_id?: string | undefined
          role?: string | undefined
          spending_limit?: number | null | undefined
          monthly_limit?: number | null | undefined
          cost_center?: string | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── notification_templates ──────────────────────────────────────────────
      notification_templates: {
        Row: {
          id: string
          company_id: string | null
          channel: NotificationChannel
          type: string
          subject: string | null
          body: string
          variables: string[] | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id?: string | null | undefined
          channel: NotificationChannel
          type: string
          subject?: string | null | undefined
          body: string
          variables?: string[] | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | null | undefined
          channel?: NotificationChannel | undefined
          type?: string | undefined
          subject?: string | null | undefined
          body?: string | undefined
          variables?: string[] | null | undefined
          is_active?: boolean | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── notifications ───────────────────────────────────────────────────────
      notifications: {
        Row: {
          id: string
          company_id: string
          user_id: string | null
          booking_id: string | null
          template_id: string | null
          channel: NotificationChannel
          type: string
          recipient: string
          subject: string | null
          body: string
          status: string
          provider_id: string | null
          error_message: string | null
          sent_at: string | null
          delivered_at: string | null
          opened_at: string | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          user_id?: string | null | undefined
          booking_id?: string | null | undefined
          template_id?: string | null | undefined
          channel: NotificationChannel
          type: string
          recipient: string
          subject?: string | null | undefined
          body: string
          status?: string | undefined
          provider_id?: string | null | undefined
          error_message?: string | null | undefined
          sent_at?: string | null | undefined
          delivered_at?: string | null | undefined
          opened_at?: string | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          user_id?: string | null | undefined
          booking_id?: string | null | undefined
          template_id?: string | null | undefined
          channel?: NotificationChannel | undefined
          type?: string | undefined
          recipient?: string | undefined
          subject?: string | null | undefined
          body?: string | undefined
          status?: string | undefined
          provider_id?: string | null | undefined
          error_message?: string | null | undefined
          sent_at?: string | null | undefined
          delivered_at?: string | null | undefined
          opened_at?: string | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }

      // ── documents ───────────────────────────────────────────────────────────
      documents: {
        Row: {
          id: string
          company_id: string
          driver_id: string | null
          vehicle_id: string | null
          type: DocumentType
          file_url: string
          file_name: string
          file_size_bytes: number | null
          mime_type: string | null
          expires_at: string | null
          verified_at: string | null
          verified_by: string | null
          is_verified: boolean | null
          rejection_reason: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string | undefined
          company_id: string
          driver_id?: string | null | undefined
          vehicle_id?: string | null | undefined
          type: DocumentType
          file_url: string
          file_name: string
          file_size_bytes?: number | null | undefined
          mime_type?: string | null | undefined
          expires_at?: string | null | undefined
          verified_at?: string | null | undefined
          verified_by?: string | null | undefined
          is_verified?: boolean | null | undefined
          rejection_reason?: string | null | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | undefined
          driver_id?: string | null | undefined
          vehicle_id?: string | null | undefined
          type?: DocumentType | undefined
          file_url?: string | undefined
          file_name?: string | undefined
          file_size_bytes?: number | null | undefined
          mime_type?: string | null | undefined
          expires_at?: string | null | undefined
          verified_at?: string | null | undefined
          verified_by?: string | null | undefined
          is_verified?: boolean | null | undefined
          rejection_reason?: string | null | undefined
          notes?: string | null | undefined
          created_at?: string | undefined
          updated_at?: string | undefined
        }
        Relationships: []
      }

      // ── audit_logs (stub) ───────────────────────────────────────────────────
      audit_logs: {
        Row: {
          id: string
          company_id: string | null
          user_id: string | null
          action: string
          table_name: string | null
          record_id: string | null
          old_values: Json | null
          new_values: Json | null
          ip_address: string | null
          user_agent: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string | undefined
          company_id?: string | null | undefined
          user_id?: string | null | undefined
          action: string
          table_name?: string | null | undefined
          record_id?: string | null | undefined
          old_values?: Json | null | undefined
          new_values?: Json | null | undefined
          ip_address?: string | null | undefined
          user_agent?: string | null | undefined
          metadata?: Json | null | undefined
          created_at?: string | undefined
        }
        Update: {
          id?: string | undefined
          company_id?: string | null | undefined
          user_id?: string | null | undefined
          action?: string | undefined
          table_name?: string | null | undefined
          record_id?: string | null | undefined
          old_values?: Json | null | undefined
          new_values?: Json | null | undefined
          ip_address?: string | null | undefined
          user_agent?: string | null | undefined
          metadata?: Json | null | undefined
          created_at?: string | undefined
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      user_role: UserRole
      company_status: CompanyStatus
      company_plan: CompanyPlan
      vehicle_class: VehicleClass
      vehicle_status: VehicleStatus
      booking_status: BookingStatus
      booking_type: BookingType
      pricing_model: PricingModel
      payment_status: PaymentStatus
      payment_method_type: PaymentMethodType
      notification_channel: NotificationChannel
      document_type: DocumentType
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}
