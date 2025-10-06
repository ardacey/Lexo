import os
from dotenv import load_dotenv

load_dotenv()

LETTER_FREQUENCY = {
    'a': 11.92, 'e': 8.91, 'i': 8.60, 'ı': 5.12, 'n': 7.49,
    'r': 6.95, 'l': 5.75, 'k': 4.72, 'd': 4.68, 't': 3.31,
    's': 3.00, 'm': 2.99, 'y': 2.96, 'u': 2.88, 'o': 2.61,
    'b': 2.56, 'ü': 1.85, 'z': 1.50, 'ş': 1.48, 'ç': 1.14,
    'g': 1.12, 'ğ': 1.12, 'p': 0.89, 'h': 0.84, 'v': 0.82,
    'c': 0.80, 'ö': 0.85, 'j': 0.03, 'f': 0.44
}

LETTER_SCORES = {
    'a': 1, 'e': 1, 'i': 1, 'ı': 1, 'n': 1, 'r': 1, 'l': 1,
    'k': 2, 'd': 2, 't': 2, 's': 2, 'm': 2, 'y': 2, 'u': 2,
    'o': 3, 'b': 3, 'ü': 3, 'z': 4, 'ş': 4, 'ç': 4,
    'g': 5, 'ğ': 5, 'p': 5, 'h': 5, 'v': 5, 'c': 5, 'ö': 5,
    'j': 10, 'f': 5
}

VOWELS = ['a', 'e', 'i', 'ı', 'o', 'ö', 'u', 'ü']
CONSONANTS = ['b', 'c', 'ç', 'd', 'f', 'g', 'ğ', 'h', 'j', 'k', 'l', 'm', 'n', 'p', 'r', 's', 'ş', 't', 'v', 'y', 'z']

GAME_SETTINGS = {
    'default_duration': int(os.getenv('GAME_DURATION', '60')),
    'letter_pool_size': int(os.getenv('LETTER_POOL_SIZE', '16')),
    'min_word_length': int(os.getenv('MIN_WORD_LENGTH', '2')),
    'min_vowel_ratio': 0.3,
    'min_consonant_ratio': 0.5,
    'length_bonus_threshold_1': 5,
    'length_bonus_threshold_2': 7,
    'length_bonus_multiplier_1': 2,
    'length_bonus_multiplier_2': 3,
}

API_SETTINGS = {
    'title': os.getenv('API_TITLE', 'Lexo Multiplayer API'),
    'version': os.getenv('API_VERSION', '1.0.0'),
    'host': os.getenv('API_HOST', '0.0.0.0'),
    'port': int(os.getenv('API_PORT', '8000')),
    'cors_origins': os.getenv('CORS_ORIGINS', '*').split(',') if os.getenv('CORS_ORIGINS') != '*' else ['*'],
}

FILE_PATHS = {
    'words_file': os.getenv('WORDS_FILE', 'turkish_words.txt'),
}

LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')

DATABASE_URL = os.getenv(
    'DATABASE_URL', 
    'postgresql://postgres:postgres@localhost:5432/lexo_db'
)
