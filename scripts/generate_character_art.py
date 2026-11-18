"""Build production-ready, unique cinematic illustrations for the 33 canonical
fictional WorkforceOS agents using an external image synthesis endpoint.

Nothing in this script fabricates a working agent, creator, review, or benchmark.
The resulting assets are fictional character illustrations, not real employees.
"""
from __future__ import annotations
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
from io import BytesIO
import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from PIL import Image, ImageOps
from app.workforce_roster import ROSTER

CHARACTERS = {
  "orion": "distinguished man age 52 with naturally silver wavy hair, groomed salt-and-pepper beard, navy wool checked three-piece jacket, articulate executive strategy leader",
  "archive_researcher": "intellectual woman age 36 with wavy pinned-up chestnut hair, round thin bronze eyeglasses, cream high-collar Victorian blouse, dark academic blazer, old-world historian",
  "lyra": "confident woman age 30 with shoulder-length chestnut curls, artistic dark burgundy tailored jacket and ivory silk scarf, creative director in an editorial studio",
  "sales_operator": "charismatic Black woman age 34 with long elegant microbraids, tailored wine-colored blazer over ivory shirt, commercial relationship builder",
  "research_analyst": "focused mixed-heritage man age 36 with short textured dark hair, subtle glasses, classic dark charcoal tweed blazer and blue shirt, field intelligence researcher",
  "community_builder": "warm olive-skinned woman age 31 with naturally curly shoulder-length dark hair and gold hoop earrings, brown blazer over ivory turtleneck, welcoming community host",
  "ren": "poised East Asian woman age 37 with dark straight hair in an elegant low bun, contemporary midnight blue executive suit, strategic operator",
  "kairo": "energetic South Asian man age 29 with windswept black hair, muted deep teal casual blazer, growth strategist",
  "elara": "thoughtful woman age 32 with wavy shoulder-length honey-brown hair, delicate eyeglasses and ivory knit turtleneck, member experience guide",
  "sable": "composed East Asian woman age 33 with sleek black bob hairstyle, monochrome architectural charcoal high collar uniform, operations commander",
  "product_engineer": "Black man age 31 with closely cropped hair, clear industrial safety glasses, ivory hard hat and sophisticated charcoal technical workwear, industrial operations engineer",
  "operations_director": "distinguished man age 47 with dark neatly groomed beard, tailored heritage navy jacket and cream shirt, program director",
  "mira": "sharp-eyed woman age 31 with short sculptural chestnut bob and tailored ink blue vest over cream blouse, product manager",
  "forge": "rugged man age 42 with close-cropped salt-and-pepper hair, black architect spectacles, navy technical chore jacket, platform engineer",
  "quinn": "meticulous young woman age 29 with neat dark auburn pixie cut, small round glasses and tailored minimal dark blazer, quality assurance director",
  "circuit": "young Filipino man age 27 with textured dark hair, clean tailored slate-blue work jacket, automation builder",
  "terra": "confident middle-aged woman age 44 with long loosely tied dark chestnut hair, structured moss-colored jacket over silk ivory shirt, venture executive",
  "financial_analyst": "thoughtful Indian woman age 35 with dark neatly arranged hair, navy tailored pinstripe suit, subtle minimal earrings, financial analyst",
  "strategy_advisor": "distinguished grey-haired man age 59 with close silver beard and deep charcoal tailored waistcoat, contemplative strategic adviser",
  "field_observer": "Black man age 33 with neat short twists and thin rim glasses, tan documentary photographer coat over a navy turtleneck, field intelligence specialist",
  "helix": "woman age 30 with naturally curly dark hair in a half bun, smart ink-blue tailored jacket and black turtleneck, quantitative scientist",
  "cipher": "thoughtful Middle Eastern man age 34 with dark hair and neatly trimmed beard, charcoal technical jacket and minimalist spectacles, defensive security analyst",
  "pax": "composed mature woman age 48 with chin-length elegant grey-streaked dark hair, ivory blouse and classic dark suit, policy researcher",
  "flint": "confident man age 33 with wavy dark blond hair, deep blue wool jacket, pale grey shirt, revenue analyst",
  "harbor": "warm Black woman age 37 with soft natural afro and ivory blouse under fine checked jacket, customer success strategist",
  "alba": "elegant young Mediterranean woman age 30 with dark wavy hair and cream silk scarf over burgundy blazer, brand director",
  "nori": "Japanese woman age 28 with artistic straight dark bob and minimalist vibrant wine-colored jacket, social campaign strategist",
  "iris": "woman age 35 with short wavy auburn hair and thin metal eyeglasses, smart brown textured jacket, UX researcher",
  "tessa": "Black woman age 40 with hair in a polished high bun, tailored deep blue suit over cream shirt, talent recruiting partner",
  "astra": "woman age 34 with softly curled light brown hair, refined cream knit with a navy collar, warm educator",
  "customer_advocate": "friendly man age 29 with short coiled dark hair, navy casual jacket over cream rollneck, customer support specialist",
  "meridian": "mature South Asian man age 46 with salt-and-pepper hair and carefully trimmed beard, checked navy executive jacket, diplomatic partnerships director",
  "pioneer": "creative man age 32 with wavy dark blond hair and round glasses, fine black turtleneck under tailored brown vest, product design specialist",
}
BACKDROPS={
 "strategy":"warmly lit old-world library fused with modern premium executive coworking lounge, amber lamps, midnight navy glass",
 "execution":"premium architectural operations control room with restrained screens, warm tungsten highlights, contemporary industrial glass",
 "intelligence":"quiet analytical think-tank office with books, minimal chart screens, deep navy walls, natural window light",
 "creative":"beautiful luxury creative studio with storyboards, refined walnut, editorial art wall, moody warm window light",
}
ROOT=Path("public/characters")
ROOT.mkdir(parents=True, exist_ok=True)

def request_horde_image(scene,seed):
    base="https://stablehorde.net/api/v2"
    prompt=scene+" ### cut off head, chopped forehead, words, writing, watermark, robot, metal face, blurry, plastic face, low quality, extra arms, cropped eyes"
    payload={"prompt":prompt,
             "params":{"width":512,"height":640,"steps":24,"n":1,"seed":str(seed),
                       "cfg_scale":7.1,"sampler_name":"k_euler_a"},
             "nsfw":False,"censor_nsfw":True}
    headers={"Content-Type":"application/json","apikey":"0000000000",
             "Client-Agent":"WorkforceOS:1.0:NoetfieldSystems"}
    req=urllib.request.Request(base+"/generate/async",data=json.dumps(payload).encode(),
                               headers=headers,method="POST")
    with urllib.request.urlopen(req,timeout=35) as response:
        submitted=json.load(response)
    job_id=submitted.get("id")
    if not job_id:raise RuntimeError("No Horde generation id: "+str(submitted)[:200])
    for tick in range(45):
        time.sleep(8)
        with urllib.request.urlopen(base+"/generate/check/"+job_id,timeout=25) as response:
            check=json.load(response)
        if check.get("done"):break
        if check.get("faulted") or not check.get("is_possible",True):
            raise RuntimeError("Horde job faulted "+str(check)[:200])
        if tick%6==0:
            print("HORDE_WAIT",tick,job_id,"queue",check.get("queue_position"),
                  "eta",check.get("wait_time"),flush=True)
    else:raise RuntimeError("Horde generation timed out: "+job_id)
    with urllib.request.urlopen(base+"/generate/status/"+job_id,timeout=25) as response:
        status=json.load(response)
    gens=status.get("generations") or []
    if not gens or gens[0].get("censored") or gens[0].get("state")!="ok":
        raise RuntimeError("Horde result unavailable or censored")
    src_url=gens[0].get("img","")
    if not src_url.startswith("https://"):raise RuntimeError("Horde no image URL")
    with urllib.request.urlopen(src_url,timeout=70) as response:
        return response.read(5_000_000)

def build(item):
    ident=item["id"]
    spec=CHARACTERS[ident]
    backdrop=BACKDROPS[item["directory"]]
    scene=(f"Original fictional AI agent identity, premium cinematic photographic character portrait, {spec}. "
      f"Environment: {backdrop}. Sympathetic confident thoughtful expression, natural skin texture, professional "
      "luxury fashion editorial photography, cinematic tungsten practical lights and cool navy shadows, "
      "sophisticated tasteful dramatic composition, 85mm lens, shallow depth of field, tasteful desaturated colors. "
      "VERTICAL MID-CHEST PORTRAIT, camera slightly below eye level, head fully visible with generous headroom, "
      "both shoulders visible, centered subject, clear eyes and unobstructed mouth, intentional unique identity, "
      "highly detailed realistic style. No text, logos, watermarks, labels, diagrams, borders, robots, armor or mechanical faces.")
    seed=17001+ROSTER.index(item)*467
    path=ROOT/(ident+".webp")
    for attempt in range(3):
        try:
            payload=request_horde_image(scene,seed+attempt*111)
            if len(payload)<8000:raise RuntimeError("Image payload too small")
            img=ImageOps.exif_transpose(Image.open(BytesIO(payload)))
            img.load()
            if img.width<400 or img.height<500:
                raise RuntimeError(f"Undersized image {img.size}")
            img=img.convert("RGB")
            img.save(path,"WEBP",quality=86,method=6)
            check=Image.open(path)
            assert check.width>=400 and check.height>=500
            result=(ident,str(path),path.stat().st_size,hashlib.sha256(path.read_bytes()).hexdigest())
            print("CHARACTER_READY",*result[:3],flush=True)
            return result
        except (OSError, ValueError, RuntimeError, urllib.error.URLError,KeyError) as exc:
            print("CHARACTER_RETRY",ident,attempt+1,str(exc)[:180],flush=True)
            if attempt==2:raise
            time.sleep(5*(attempt+1))
    raise RuntimeError("Exhausted "+ident)

def main():
    assert len(ROSTER)==33 and len(CHARACTERS)==33
    assert set(CHARACTERS)=={x["id"] for x in ROSTER}
    with ThreadPoolExecutor(max_workers=3) as executor:
        work=[executor.submit(build,item) for item in ROSTER]
        results=[future.result() for future in as_completed(work)]
    assert len(results)==33
    assert len({sha for _,_,_,sha in results})==33, "Duplicate artwork detected"
    assert all(size>9000 for _,_,size,_ in results)
    print("ARTWORK_COMPLETED",len(results),sum(size for _,_,size,_ in results),flush=True)

if __name__=="__main__":
    main()
