import os
from typing import List
from pathlib import Path
from pydantic_settings import BaseSettings
from pydantic import Field
from dotenv import load_dotenv

env_path = Path(__file__).parent.parent.parent / '.env'
load_dotenv(dotenv_path=env_path)


class GameSettings(BaseSettings):
    default_duration: int = Field(default=60, alias='GAME_DURATION')
    letter_pool_size: int = Field(default=16, alias='LETTER_POOL_SIZE')
    min_word_length: int = Field(default=2, alias='MIN_WORD_LENGTH')
    min_vowel_ratio: float = 0.3
    min_consonant_ratio: float = 0.5
    length_bonus_threshold_1: int = 5
    length_bonus_threshold_2: int = 7
    length_bonus_multiplier_1: int = 2
    length_bonus_multiplier_2: int = 3
    
    model_config = {
        'env_file': str(Path(__file__).parent.parent.parent / '.env'),
        'env_file_encoding': 'utf-8',
        'extra': 'ignore'
    }


class APISettings(BaseSettings):
    title: str = Field(default='Lexo Multiplayer API', alias='API_TITLE')
    version: str = Field(default='1.0.0', alias='API_VERSION')
    host: str = Field(default='0.0.0.0', alias='API_HOST')
    port: int = Field(default=8000, alias='API_PORT')
    max_word_length: int = 50
    max_username_length: int = 30
    
    model_config = {
        'env_file': str(Path(__file__).parent.parent.parent / '.env'),
        'env_file_encoding': 'utf-8',
        'extra': 'ignore'
    }
    
    @property
    def cors_origins(self) -> List[str]:
        cors = os.getenv('CORS_ORIGINS', 'http://localhost:8081,http://localhost:19006')
        if cors == '*':
            return ['*']
        return cors.split(',')


class CacheSettings(BaseSettings):
    redis_url: str = Field(
        default='redis://localhost:6379/0',
        alias='REDIS_URL'
    )
    default_ttl: int = Field(default=300, alias='CACHE_DEFAULT_TTL')  # 5 minutes
    enabled: bool = Field(default=True, alias='CACHE_ENABLED')
    
    model_config = {
        'env_file': str(Path(__file__).parent.parent.parent / '.env'),
        'env_file_encoding': 'utf-8',
        'extra': 'ignore'
    }


class DatabaseSettings(BaseSettings):
    url: str = Field(
        default='postgresql://postgres:postgres@localhost:5432/lexo_db',
        alias='DATABASE_URL'
    )
    echo: bool = False
    
    model_config = {
        'env_file': str(Path(__file__).parent.parent.parent / '.env'),
        'env_file_encoding': 'utf-8',
        'extra': 'ignore'
    }


class FileSettings(BaseSettings):
    words_file: str = Field(default='turkish_words.txt', alias='WORDS_FILE')
    
    model_config = {
        'env_file': str(Path(__file__).parent.parent.parent / '.env'),
        'env_file_encoding': 'utf-8',
        'extra': 'ignore'
    }


class LogSettings(BaseSettings):
    level: str = Field(default='INFO', alias='LOG_LEVEL')
    format: str = '%(asctime)s - %(name)s - %(levelname)s - %(message)s'
    
    model_config = {
        'env_file': str(Path(__file__).parent.parent.parent / '.env'),
        'env_file_encoding': 'utf-8',
        'extra': 'ignore'
    }


class Settings(BaseSettings):
    game: GameSettings = GameSettings()
    api: APISettings = APISettings()
    cache: CacheSettings = CacheSettings()
    database: DatabaseSettings = DatabaseSettings()
    files: FileSettings = FileSettings()
    log: LogSettings = LogSettings()
    
    # For backward compatibility
    @property
    def REDIS_URL(self) -> str:
        return self.cache.redis_url


settings = Settings()