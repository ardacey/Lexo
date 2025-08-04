LETTER_FREQUENCY = {
    "a": 11.92, "b": 2.85, "c": 0.30, "ç": 2.84, "d": 3.99, "e": 8.91,
    "f": 0.88, "g": 1.25, "ğ": 0.10, "h": 1.00, "ı": 0.99, "i": 7.29,
    "j": 0.11, "k": 5.68, "l": 5.86, "m": 4.53, "n": 7.10, "o": 3.54,
    "ö": 0.73, "p": 0.89, "r": 6.81, "s": 3.30, "ş": 1.41, "t": 3.97,
    "u": 4.35, "ü": 0.60, "v": 1.15, "y": 3.61, "z": 1.50,
}

LETTER_SCORES = {
    "a": 1, "b": 3, "c": 5, "ç": 3, "d": 2, "e": 1, "f": 3, "g": 4, "ğ": 5,
    "h": 3, "ı": 1, "i": 1, "j": 10, "k": 2, "l": 1, "m": 2, "n": 1, "o": 1,
    "ö": 4, "p": 7, "r": 1, "s": 1, "ş": 3, "t": 1, "u": 1, "ü": 4, "v": 3,
    "y": 2, "z": 7,
}

VOWELS = {"a", "e", "ı", "i", "o", "ö", "u", "ü"}
CONSONANTS = {"b", "c", "ç", "d", "f", "g", "ğ", "h", "j", "k", "l", "m", "n", "p", "r", "s", "ş", "t", "v", "y", "z"}

MIN_VOWELS_IN_POOL = 5
MIN_CONSONANTS_IN_POOL = 8

BATTLE_ROYALE_COUNTDOWN_SECONDS = 60
BATTLE_ROYALE_MIN_PLAYERS = 3
BATTLE_ROYALE_MAX_PLAYERS = 16
BATTLE_ROYALE_INITIAL_POOL_SIZE = 50
BATTLE_ROYALE_GAME_DURATION = 240
BATTLE_ROYALE_ELIMINATION_INTERVAL = 30
BATTLE_ROYALE_MIN_SURVIVING_PLAYERS = 1