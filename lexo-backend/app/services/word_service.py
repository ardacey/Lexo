from typing import Set, List, Tuple

from app.core.config import settings
from app.core.logging import get_logger

logger = get_logger(__name__)

# ---------------------------------------------------------------------------
# Turkish vowel harmony helpers
# ---------------------------------------------------------------------------

_BACK_VOWELS = set("aıou")
_FRONT_VOWELS = set("eiöü")
_ALL_VOWELS = _BACK_VOWELS | _FRONT_VOWELS

# Ordered from longest to shortest so greedier matches win.
# Each tuple is (suffix_to_strip, set_of_allowed_last_chars_on_stem_or_None)
# None means no restriction on the last character of the resulting stem.
_SUFFIXES: List[Tuple[str, ...]] = [
    # ── Plural ──────────────────────────────────────────────────────────────
    ("lar", "ler"),

    # ── Possessive (1sg / 2sg / 3sg / 1pl / 2pl / 3pl) ────────────────────
    ("ım", "im", "um", "üm"),           # 1sg after cons.
    ("m",),                              # 1sg after vowel  (annem → anne)
    ("ın", "in", "un", "ün"),           # 2sg after cons.
    ("n",),                              # 2sg after vowel
    ("ı", "i", "u", "ü"),               # 3sg after cons. / acc. singular
    ("sı", "si", "su", "sü"),           # 3sg after vowel
    ("ımız", "imiz", "umuz", "ümüz"),   # 1pl
    ("mız", "miz", "muz", "müz"),       # 1pl after vowel
    ("ınız", "iniz", "unuz", "ünüz"),   # 2pl
    ("nız", "niz", "nuz", "nüz"),       # 2pl after vowel
    ("ları", "leri"),                    # 3pl possessive / acc.plural

    # ── Case suffixes ────────────────────────────────────────────────────────
    ("a", "e"),                          # dative
    ("da", "de", "ta", "te"),           # locative
    ("dan", "den", "tan", "ten"),       # ablative
    ("ın", "in", "un", "ün"),           # genitive after cons.
    ("nın", "nin", "nun", "nün"),       # genitive after vowel

    # ── Common verb / adj. suffixes ──────────────────────────────────────────
    ("lar", "ler"),                      # 3pl verb (duplicate intentional for ordering)
    ("lık", "lik", "luk", "lük"),       # noun-forming
    ("lı", "li", "lu", "lü"),           # adjective-forming
    ("sız", "siz", "suz", "süz"),       # negation adj.
    ("cı", "ci", "cu", "cü",
     "çı", "çi", "çu", "çü"),          # agent noun
    ("mak", "mek"),                      # verb infinitive
    ("mış", "miş", "muş", "müş"),       # past participle
    ("yor",),                            # present cont. stem (geli + yor → geliyor)
    ("dı", "di", "du", "dü",
     "tı", "ti", "tu", "tü"),           # simple past
    ("dım", "dim", "dum", "düm",
     "tım", "tim", "tum", "tüm"),       # 1sg past
    ("dın", "din", "dun", "dün",
     "tın", "tin", "tun", "tün"),       # 2sg past
    ("dık", "dik", "duk", "dük",
     "tık", "tik", "tuk", "tük"),       # past participle / verbal noun
    ("arak", "erek"),                    # adverbial
    ("madan", "meden"),                  # negative adverbial
]

# Deduplicate while preserving order
_seen: set = set()
_SUFFIX_LIST: List[str] = []
for group in _SUFFIXES:
    for sfx in group:
        if sfx not in _seen:
            _seen.add(sfx)
            _SUFFIX_LIST.append(sfx)
# Sort longest-first so we try longer suffixes before shorter ones
_SUFFIX_LIST.sort(key=len, reverse=True)


def _vowel_count(s: str) -> int:
    return sum(1 for c in s if c in _ALL_VOWELS)


def _candidate_stems(word: str) -> List[str]:
    """
    Return a list of possible root forms by stripping Turkish suffixes.
    Only yields stems that still contain at least one vowel and are at
    least 2 characters long, to avoid matching garbage.
    """
    stems = []
    for sfx in _SUFFIX_LIST:
        if word.endswith(sfx) and len(word) > len(sfx) + 1:
            stem = word[: -len(sfx)]
            if len(stem) >= 2 and _vowel_count(stem) >= 1:
                stems.append(stem)
                # Also try with the final consonant doubled back (Turkish
                # consonant mutation: kitap → kitabı; we approximate by
                # trying the stem with its last vowel-adjacent consonant restored)
    return stems


class WordService:

    def __init__(self):
        self.valid_words: Set[str] = set()
        self._load_words()

    def _load_words(self):
        words_file = settings.files.words_file
        try:
            with open(words_file, "r", encoding="utf-8") as f:
                self.valid_words = set(
                    line.strip().lower()
                    for line in f
                    if line.strip()
                )
            logger.info(f"Loaded {len(self.valid_words)} Turkish words")
        except FileNotFoundError:
            logger.warning(f"{words_file} not found")
            self.valid_words = set()

    def is_valid_word(self, word: str) -> bool:
        """
        Return True when the word (or one of its likely stems) is in the
        dictionary.

        Direct lookup first (fast path).  If not found, try stripping the
        most common Turkish inflectional suffixes and checking whether the
        resulting stem exists — this catches common inflected forms like
        "arabam", "annem", "masalar", "geldim" that may be absent from the
        static word list while still rejecting gibberish.
        """
        word_lower = word.lower()

        # Fast path: exact match
        if word_lower in self.valid_words:
            return True

        # Suffix-stripping fallback
        for stem in _candidate_stems(word_lower):
            if stem in self.valid_words:
                return True

        return False

    def get_word_count(self) -> int:
        return len(self.valid_words)
