// pages/api/submit.js
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

function genCompletionCode() {
  return "C-" + Math.random().toString(36).substring(2, 10).toUpperCase();
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    const payload = req.body;

    if (!payload || !payload.participantId) {
      return res.status(400).json({ error: "Missing participantId" });
    }

    const completionCode = genCompletionCode();

    const insertObj = {
      participantId: payload.participantId,
      consent: payload.consent,
      ageGroup: payload.ageGroup,
      gender: payload.gender,

      assignedAdCode: payload.assignedAdCode,
      assignedAdURL: payload.assignedAdURL,

      startTime: payload.startTime,
      endTime: payload.endTime,
      watchSeconds: payload.watchSeconds,

      clickedMoreInfo: payload.clickedMoreInfo,
      moreInfoURL: payload.moreInfoURL,

      responses: payload.responses,
      timestamp: payload.timestamp,
      completionCode
    };

    const { data, error } = await supabase.from("responses").insert([insertObj]);

    if (error) {
      console.error("Supabase insert error:", error);
      return res.status(500).json({
        error: "db_insert_failed",
        details: error.message
      });
    }

    return res.status(200).json({
      status: "ok",
      completionCode
    });

  } catch (err) {
    console.error("Submit error:", err);
    return res.status(500).json({ error: err.message });
  }
}