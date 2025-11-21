import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL,
process.env.SUPABASE_SERVICE_KEY
);

export default async function handler(req, res) {
if (req.method !== "POST") {
return res.status(405).json({ error: "Method not allowed" });
}

try {
const { data, error } = await supabase.from("responses").insert([req.body]);

if (error) throw error;

return res.status(200).json({ status: "ok" });
} catch (err) {
return res.status(500).json({ error: err.message });
}
}