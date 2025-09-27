"""
Embedding Service using HuggingFace sentence-transformers/all-MiniLM-L6-v2
"""
import os
from typing import List
from sentence_transformers import SentenceTransformer
from langchain_community.embeddings import HuggingFaceEmbeddings


class EmbeddingService:
    """Service for generating embeddings using HuggingFace all-MiniLM-L6-v2"""
    
    _instance = None
    _model = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._model is None:
            model_name = os.getenv("EMBEDDING_MODEL", "sentence-transformers/all-MiniLM-L6-v2")
            print(f"Loading embedding model: {model_name}")
            
            # Initialize HuggingFace embeddings for LangChain
            self._model = HuggingFaceEmbeddings(
                model_name=model_name,
                model_kwargs={'device': 'cpu'},
                encode_kwargs={'normalize_embeddings': True}
            )
            
            # Also keep a direct SentenceTransformer for flexibility
            self._sentence_transformer = SentenceTransformer(model_name)
            print("Embedding model loaded successfully!")
    
    def get_langchain_embeddings(self) -> HuggingFaceEmbeddings:
        """Get LangChain-compatible embeddings"""
        return self._model
    
    def embed_text(self, text: str) -> List[float]:
        """Embed a single text"""
        return self._model.embed_query(text)
    
    def embed_documents(self, documents: List[str]) -> List[List[float]]:
        """Embed multiple documents"""
        return self._model.embed_documents(documents)
    
    def embed_with_sentence_transformer(self, texts: List[str]) -> List[List[float]]:
        """Direct embedding using SentenceTransformer"""
        embeddings = self._sentence_transformer.encode(texts, normalize_embeddings=True)
        return embeddings.tolist()


# Singleton instance
embedding_service = EmbeddingService()

# Ashmit contribution
