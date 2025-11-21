// pages/api/submit.js
import { createClient } from "@supabase/supabase-js";

// Initialize Supabase client
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } }
);

// Generate a unique completion code
function genCompletionCode() {
  return "C-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req, res) {
  // Only allow POST requests
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

    // Validate required fields
    if (!payload || !payload.participantId) {
      return res.status(400).json({ error: "Missing participantId" });
    }

    // Generate completion code
    const completionCode = genCompletionCode();

    // Prepare data for insertion
    const insertObj = {
      participant_id: payload.participantId,
      consent: payload.consent,
      age_group: payload.ageGroup,
      gender: payload.gender,
      assigned_ad_code: payload.assignedAdCode,
      assigned_ad_url: payload.assignedAdURL,
      start_time: payload.startTime,
      end_time: payload.endTime,
      watch_seconds: payload.watchSeconds,
      clicked_more_info: payload.clickedMoreInfo,
      more_info_url: payload.moreInfoURL,
      responses: payload.responses,
      timestamp: payload.timestamp,
      completion_code: completionCode
    };

    // Insert into Supabase
    const { data, error } = await supabase
      .from("responses")
      .insert([insertObj])
      .select();

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        error: "db_insert_failed",
        details: error.message
      });
    }

    // Return success response
    return res.status(200).json({
      status: "ok",
      completionCode
    });
  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ 
      error: "Internal server error",
      details: err.message 
    });
  }
}