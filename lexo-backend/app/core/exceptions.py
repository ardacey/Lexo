class LexoException(Exception):
    def __init__(self, message: str, status_code: int = 500):
        self.message = message
        self.status_code = status_code
        super().__init__(self.message)


class ValidationError(LexoException):
    def __init__(self, message: str):
        super().__init__(message, status_code=400)


class NotFoundError(LexoException):
    def __init__(self, message: str):
        super().__init__(message, status_code=404)


class GameError(LexoException):
    def __init__(self, message: str, status_code: int = 400):
        super().__init__(message, status_code)


class DatabaseError(LexoException):
    def __init__(self, message: str):
        super().__init__(message, status_code=500)


class WebSocketError(LexoException):
    def __init__(self, message: str):
        super().__init__(message, status_code=500)
