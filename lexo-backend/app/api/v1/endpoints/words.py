from fastapi import APIRouter, Depends, HTTPException

from app.models.schemas import ValidateWordRequest, ValidateWordResponse
from app.services.word_service import WordService
from app.dependencies import get_word_service
from app.core.logging import get_logger

logger = get_logger(__name__)

router = APIRouter()


@router.post("/validate-word", response_model=ValidateWordResponse)
@router.post("/validate", response_model=ValidateWordResponse)
def validate_word(
    request: ValidateWordRequest,
    word_service: WordService = Depends(get_word_service)
) -> ValidateWordResponse:
    try:
        word = request.word.strip().lower()
        
        if len(word) < 2:
            return ValidateWordResponse(
                valid=False,
                message="Kelime en az 2 harf olmalıdır"
            )
        
        is_valid = word_service.is_valid_word(word)
        
        return ValidateWordResponse(
            valid=is_valid,
            message="Geçerli bir Türkçe kelime" if is_valid else "Geçerli bir Türkçe kelime değil"
        )
    except ValueError as e:
        return ValidateWordResponse(
            valid=False,
            message=str(e)
        )
    except Exception as e:
        logger.error(f"Error validating word: {e}")
        raise HTTPException(status_code=500, detail="Internal server error")
