import json

transcript_path = "/Users/ub-col-pro-lf4/.gemini/antigravity/brain/785fd747-beb2-448b-aa59-ac34f47f565e/.system_generated/logs/transcript_full.jsonl"

with open(transcript_path, "r", encoding="utf-8") as f:
    for line in f:
        try:
            data = json.loads(line)
            if data.get("type") == "TOOL_RESPONSE":
                content = data.get("content", "")
                if "export function ObjetivosConfigDrawer" in content and "activeTab === \"permisos\"" in content and "activeTab === \"estados\"" in content:
                    # Let's extract the full file if it was read with cat. 
                    # But if it was read with sed, it might not be the full file.
                    if "cat src/components/objetivos/ObjetivosConfigDrawer.tsx" in line or True:
                        print("FOUND A MATCH!")
                        # Write it out so I can inspect
                        with open("found_in_transcript.txt", "a", encoding="utf-8") as out:
                            out.write(content + "\n" + "="*80 + "\n")
        except:
            pass
