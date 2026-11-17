# WorkforceOS Character Art v6 — source and display contract

This release replaces flat SVG-only artwork in the public AI agent marketplace with **curated, realistic robot character photography and 3D artwork**. Images are editorial metaphors for AI agents. They are **not photos of the software agent itself**, evidence of its capabilities, a saleable robot device, or an endorsement/affiliation with the pictured hardware manufacturer.

All source pages below were checked on 2026-11-17 and marked *Free to use under the Unsplash License*. Image assets remain served from Unsplash CDN with a first-party SVG fallback. Do not use Unsplash+ / premium assets. Licensed image permissions and downstream constraints should be checked again if marketing usage materially changes.

| Template | Image source | Art direction |
|---|---|---|
| `sales_operator` | https://unsplash.com/photos/an-orange-robot-with-a-friendly-face-D8QF71s-NNM | Orange friendly commercial specialist |
| `research_analyst` | https://unsplash.com/photos/a-futuristic-chrome-robot-with-glowing-yellow-eyes-NtvR8JNQ3Eg | Chrome investigative intelligence |
| `product_engineer` | https://unsplash.com/photos/a-white-robot-is-standing-in-front-of-a-black-background-CjWsslYVnPI | Minimal white engineering android |
| `creative_partner` | https://unsplash.com/photos/a-red-robot-is-standing-on-a-pink-background-unt3066GV-E | Red expressive creative robot |
| `personal_guide` | https://unsplash.com/photos/a-yellow-robot-is-standing-on-a-tile-floor-LWiMzIQrydE | Playful yellow retro companion |
| `community_builder` | https://unsplash.com/photos/two-robots-with-glowing-faces-and-cat-like-ears-aL3HP-7ctLQ | Social robot duo |
| `archive_researcher` | https://unsplash.com/photos/a-robot-that-is-standing-in-the-water-ykO7Nb5pQt8 | Weathered explorer robot |
| `financial_analyst` | https://unsplash.com/photos/glowing-eyes-emanate-from-a-digital-face-EYm7NP5KsZw | Midnight cybernetic analyst |
| `operations_director` | https://unsplash.com/photos/futuristic-robot-head-with-glowing-red-triangle-symbol-p9LR8AtfaZM | Rugged industrial command agent |
| `customer_advocate` | https://unsplash.com/photos/close-up-of-an-orange-robots-face-with-blue-eyes-pi3G-PIhaog | Expressive warm support robot |
| `strategy_advisor` | https://unsplash.com/photos/a-spooky-face-peeks-from-the-darkness-xYRi3h8F8a8 | Dark strategic machine portrait |
| `field_observer` | https://unsplash.com/photos/a-computer-generated-image-of-a-robot-with-wheels-r6WHFam05Ys | Mobile field observer |

## Acceptance contract

- Real public templates from `/api/agent-dna/catalog` and real opt-in profiles from `/api/agent-dna/gallery`. No fictitious reviews, orders, performance metrics, revenue, access entitlements or test results.
- Each of the twelve official templates has a unique photo URL, an independent color treatment, and a distinct vector fallback.
- Visual-only layer: `public/agent-art.js`, `public/marketplace-v6.css` and `public/agent-studio-v6.css`. Source-of-truth configuration, task execution, account, billing and safety constraints are not changed.
- Character photos can be skipped if network/CDN fails; SVG fallback remains present. A captured browser acceptance run checks photo loading in desktop and mobile.
- UI must remain responsive, keyboard-accessible and respect reduced-motion.
