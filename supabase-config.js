const SUPABASE_URL =
    "https://keeyaworqbjsjfekorhd.supabase.co";

const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_BqwK9AWNmr07j6maco-EEQ_Tafq7rJ9";


if (typeof window.supabase === "undefined") {

    console.error(
        "HOSTELPRO: Supabase library was not loaded."
    );

} else {

    window.supabaseClient =
        window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

    console.log(
        "HOSTELPRO: Supabase client initialized successfully."
    );
}