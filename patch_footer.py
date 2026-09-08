import re

with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'r') as f:
    content = f.read()

footer_injection = r"""          <div className="flex items-center gap-2">
            <button"""

footer_replacement = """          <div className="flex items-center gap-2">
            {editingId === null && (
              <>
                <button"""
content = content.replace(footer_injection, footer_replacement)

# Now we need to close the <> block inside that div. The div ends at `</div>\n        </footer>`
# Let's search for `</div>\n        </footer>` and replace it with `</>\n            )}\n          </div>\n        </footer>`
# Actually, the div ending is right before `</footer>`. Let's be precise.
div_ending = r"""              </button>
            \)}
          </div>
        </footer>"""

div_ending_new = """              </button>
            )}
            </>
            )}
          </div>
        </footer>"""
content = re.sub(div_ending, div_ending_new, content)

with open('src/components/ciclo-builder/AiObjectiveComposer.tsx', 'w') as f:
    f.write(content)
