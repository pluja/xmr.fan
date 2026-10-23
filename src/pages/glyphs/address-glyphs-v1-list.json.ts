import data from "../../../spec/address-glyphs-v1-list.json";

export const GET = () => new Response(JSON.stringify(data, null, 1), { headers: { "Content-Type": "application/json; charset=utf-8", "Access-Control-Allow-Origin": "*" } });
