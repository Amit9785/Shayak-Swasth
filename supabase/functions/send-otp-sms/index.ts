import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    let body;
    try {
      body = await req.json()
    } catch (e) {
      return new Response(
        JSON.stringify({ error: 'Invalid JSON body' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Support both old format (phone, otp) and new format (patient_id, phone, purpose, etc.)
    const { 
      phone, 
      otp: providedOtp, 
      patient_id, 
      purpose, 
      requester_name, 
      requester_id,
      requester_type = 'doctor'
    } = body || {}

    if (!phone) {
      return new Response(
        JSON.stringify({ error: 'Phone number is required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    const supabase = createClient(supabaseUrl, supabaseServiceKey)

    // Generate OTP if not provided
    const otp = providedOtp || Math.floor(100000 + Math.random() * 900000).toString()
    
    // Format phone number (ensure it has country code)
    let formattedPhone = phone.replace(/\s/g, '').replace(/-/g, '')
    if (!formattedPhone.startsWith('+')) {
      // Default to India if no country code
      formattedPhone = '+91' + formattedPhone.replace(/^0/, '')
    }

    // If we have patient_id and requester_id, store the OTP in the database
    if (patient_id && requester_id) {
      const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString() // 5 minutes

      // First, invalidate any existing unused OTPs for this patient/requester
      await supabase
        .from('access_otp')
        .update({ used: true })
        .eq('patient_id', patient_id)
        .eq('requester_id', requester_id)
        .eq('verified', false)
        .eq('used', false)

      // Insert new OTP
      const { error: insertError } = await supabase
        .from('access_otp')
        .insert({
          patient_id,
          requester_id,
          requester_type: requester_type || 'doctor',
          otp_code: otp,
          phone_number: formattedPhone,
          purpose: purpose || 'record_access',
          expires_at: expiresAt
        })

      if (insertError) {
        console.error('Error storing OTP:', insertError)
        // Continue anyway - we can still send the SMS
      }
    }

    // Get Twilio credentials from environment variables
    const TWILIO_ACCOUNT_SID = Deno.env.get('TWILIO_ACCOUNT_SID')
    const TWILIO_AUTH_TOKEN = Deno.env.get('TWILIO_AUTH_TOKEN')
    const TWILIO_PHONE_NUMBER = Deno.env.get('TWILIO_PHONE_NUMBER')

    if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
      console.log('Twilio not configured - returning OTP for development')
      console.log(`DEV MODE: OTP for ${formattedPhone} is ${otp}`)
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'OTP generated (SMS not configured)',
          dev_mode: true,
          otp: otp // Only for development!
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Build message based on requester
    let messageBody = `Your CareAccess verification code is: ${otp}. Valid for 5 minutes. Do not share this code.`
    if (requester_name) {
      messageBody = `Dr. ${requester_name} is requesting access to your medical records. Your verification code is: ${otp}. Share this code only if you consent. Valid for 5 minutes.`
    }

    // Send SMS via Twilio
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`

    console.log(`Sending OTP SMS to ${formattedPhone}`)

    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedPhone,
        From: TWILIO_PHONE_NUMBER,
        Body: messageBody,
      }),
    })

    const result = await response.json()

    if (response.ok) {
      console.log('SMS sent successfully:', result.sid)
      return new Response(
        JSON.stringify({ success: true, message: 'OTP sent successfully', sid: result.sid }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      console.error('Twilio error:', result)
      return new Response(
        JSON.stringify({ error: result.message || 'Failed to send SMS', details: result }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

  } catch (error) {
    console.error('Error in send-otp-sms:', error)
    return new Response(
      JSON.stringify({ error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

// Ashmit contribution
