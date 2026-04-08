const { createClient } = require("@supabase/supabase-js");
require("dotenv").config({ path: ".env.local" });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  const { data } = await supabase
    .from("scheduled_posts")
    .select("*, generated_post:generated_posts(*)")
    .eq("status", "failed")
    .order("created_at", { ascending: false })
    .limit(1);
    
  console.log(JSON.stringify(data[0], null, 2));
}
run();
