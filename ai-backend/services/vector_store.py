"""
Vector Store Service using ChromaDB Cloud
"""
import os
from typing import List, Dict, Any, Optional
import chromadb
from chromadb.config import Settings
from langchain_community.vectorstores import Chroma
from langchain.schema import Document

from services.embeddings import embedding_service


class VectorStoreService:
    """Service for managing medical record embeddings in ChromaDB Cloud"""
    
    _instance = None
    _client = None
    _collection = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
        return cls._instance
    
    def __init__(self):
        if self._client is None:
            # Check if using ChromaDB Cloud
            chroma_api_key = os.getenv("CHROMA_API_KEY")
            chroma_tenant = os.getenv("CHROMA_TENANT")
            chroma_database = os.getenv("CHROMA_DATABASE")
            
            if chroma_api_key and chroma_tenant and chroma_database:
                # Use ChromaDB Cloud
                print(f"Connecting to ChromaDB Cloud (database: {chroma_database})...")
                self._client = chromadb.CloudClient(
                    api_key=chroma_api_key,
                    tenant=chroma_tenant,
                    database=chroma_database
                )
                print("✅ Connected to ChromaDB Cloud!")
            else:
                # Fallback to local ChromaDB
                persist_directory = os.getenv("CHROMA_PERSIST_DIRECTORY", "./chroma_db")
                print(f"Using local ChromaDB at {persist_directory}")
                self._client = chromadb.PersistentClient(path=persist_directory)
            
            # Create or get the medical records collection
            self._collection = self._client.get_or_create_collection(
                name="medical_records",
                metadata={"description": "Medical records embeddings for patient health data"}
            )
            
            print("✅ Vector store initialized successfully!")
    
    def add_document(
        self,
        document_id: str,
        content: str,
        metadata: Dict[str, Any]
    ) -> bool:
        """Add a document to the vector store"""
        try:
            # Generate embedding
            embedding = embedding_service.embed_text(content)
            
            # Add to ChromaDB
            self._collection.add(
                ids=[document_id],
                embeddings=[embedding],
                documents=[content],
                metadatas=[metadata]
            )
            
            return True
        except Exception as e:
            print(f"Error adding document: {e}")
            return False
    
    def add_documents_batch(
        self,
        documents: List[Dict[str, Any]]
    ) -> bool:
        """Add multiple documents to the vector store"""
        try:
            ids = [doc["id"] for doc in documents]
            contents = [doc["content"] for doc in documents]
            metadatas = [doc.get("metadata", {}) for doc in documents]
            
            # Generate embeddings
            embeddings = embedding_service.embed_documents(contents)
            
            # Add to ChromaDB
            self._collection.add(
                ids=ids,
                embeddings=embeddings,
                documents=contents,
                metadatas=metadatas
            )
            
            return True
        except Exception as e:
            print(f"Error adding documents batch: {e}")
            return False
    
    def search(
        self,
        query: str,
        patient_id: Optional[str] = None,
        n_results: int = 5
    ) -> List[Dict[str, Any]]:
        """Search for similar documents"""
        try:
            # Build filter if patient_id is provided
            where_filter = {"patient_id": patient_id} if patient_id else None
            
            # Generate query embedding
            query_embedding = embedding_service.embed_text(query)
            
            # Search in ChromaDB
            results = self._collection.query(
                query_embeddings=[query_embedding],
                n_results=n_results,
                where=where_filter
            )
            
            # Format results
            documents = []
            if results and results['documents']:
                for i, doc in enumerate(results['documents'][0]):
                    documents.append({
                        "id": results['ids'][0][i] if results['ids'] else None,
                        "content": doc,
                        "metadata": results['metadatas'][0][i] if results['metadatas'] else {},
                        "distance": results['distances'][0][i] if results.get('distances') else None
                    })
            
            return documents
        except Exception as e:
            print(f"Error searching documents: {e}")
            return []
    
    def get_langchain_retriever(self, patient_id: Optional[str] = None, k: int = 5):
        """Get a LangChain retriever for RAG"""
        search_kwargs = {"k": k}
        if patient_id:
            search_kwargs["filter"] = {"patient_id": patient_id}
        
        return self._langchain_store.as_retriever(search_kwargs=search_kwargs)
    
    def delete_document(self, document_id: str) -> bool:
        """Delete a document from the vector store"""
        try:
            self._collection.delete(ids=[document_id])
            return True
        except Exception as e:
            print(f"Error deleting document: {e}")
            return False
    
    def delete_patient_documents(self, patient_id: str) -> bool:
        """Delete all documents for a patient"""
        try:
            self._collection.delete(where={"patient_id": patient_id})
            return True
        except Exception as e:
            print(f"Error deleting patient documents: {e}")
            return False


# Singleton instance
vector_store = VectorStoreService()

# Ashmit contribution
