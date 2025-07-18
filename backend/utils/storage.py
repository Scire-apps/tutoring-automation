import os
import logging
import uuid
from typing import Dict, Any, Optional, BinaryIO
from werkzeug.utils import secure_filename
from .db import get_supabase_client

# Configure logging
logger = logging.getLogger(__name__)

class StorageService:
    """Storage service for file uploads"""
    
    _instance = None
    
    def __new__(cls):
        """Singleton pattern to ensure only one storage service instance"""
        if cls._instance is None:
            cls._instance = super(StorageService, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance
    
    def _initialize(self):
        """Initialize storage service configuration"""
        self.provider = os.environ.get("STORAGE_PROVIDER", "supabase")
        self.max_size_mb = int(os.environ.get("MAX_UPLOAD_SIZE_MB", "100"))
        self.allowed_types = os.environ.get("ALLOWED_FILE_TYPES", "mp3,mp4,wav,m4a").split(",")
        
        # Convert MB to bytes for size validation
        self.max_size_bytes = self.max_size_mb * 1024 * 1024
    
    def validate_file(self, filename: str, file_size: int) -> Dict[str, Any]:
        """
        Validate file before upload
        
        Args:
            filename: Name of the file
            file_size: Size of the file in bytes
            
        Returns:
            Dict: Validation result with status and message
        """
        # Check file extension
        ext = filename.rsplit('.', 1)[1].lower() if '.' in filename else ''
        if ext not in self.allowed_types:
            return {
                "valid": False,
                "message": f"File type not allowed. Allowed types: {', '.join(self.allowed_types)}"
            }
            
        # Check file size
        if file_size > self.max_size_bytes:
            return {
                "valid": False,
                "message": f"File too large. Maximum size: {self.max_size_mb}MB"
            }
            
        return {"valid": True, "message": "File is valid"}
    
    def upload_file(self, file_obj: BinaryIO, filename: str, 
                   metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Upload a file to storage
        
        Args:
            file_obj: File object to upload
            filename: Original filename
            metadata: Optional metadata for the file
            
        Returns:
            Dict: Upload result with status, message, and file info
        """
        try:
            # Secure filename and generate unique ID
            secure_name = secure_filename(filename)
            file_id = str(uuid.uuid4())
            ext = secure_name.rsplit('.', 1)[1].lower() if '.' in secure_name else ''
            storage_path = f"session-recordings/{file_id}.{ext}"
            
            if self.provider == "supabase":
                # Upload to Supabase Storage
                supabase = get_supabase_client()
                
                # Create bucket if it doesn't exist
                try:
                    supabase.storage.create_bucket("session-recordings")
                except Exception:
                    # Bucket might already exist
                    pass
                
                # Upload file
                result = supabase.storage.from_("session-recordings").upload(
                    f"{file_id}.{ext}",
                    file_obj.read(),
                    {"content-type": f"audio/{ext}" if ext in ["mp3", "wav"] else f"video/{ext}"}
                )
                
                # Get public URL
                file_url = supabase.storage.from_("session-recordings").get_public_url(f"{file_id}.{ext}")
                
                return {
                    "success": True,
                    "message": "File uploaded successfully",
                    "file_id": file_id,
                    "filename": secure_name,
                    "storage_path": storage_path,
                    "url": file_url,
                    "metadata": metadata or {}
                }
            else:
                return {
                    "success": False,
                    "message": f"Storage provider '{self.provider}' not supported"
                }
        except Exception as e:
            logger.error(f"Error uploading file: {str(e)}")
            return {
                "success": False,
                "message": f"Error uploading file: {str(e)}"
            }
    
    def delete_file(self, file_path: str) -> Dict[str, Any]:
        """
        Delete a file from storage
        
        Args:
            file_path: Path to the file in storage
            
        Returns:
            Dict: Deletion result with status and message
        """
        try:
            if self.provider == "supabase":
                # Extract filename from path
                filename = file_path.split("/")[-1]
                
                # Delete from Supabase Storage
                supabase = get_supabase_client()
                supabase.storage.from_("session-recordings").remove([filename])
                
                return {
                    "success": True,
                    "message": "File deleted successfully"
                }
            else:
                return {
                    "success": False,
                    "message": f"Storage provider '{self.provider}' not supported"
                }
        except Exception as e:
            logger.error(f"Error deleting file: {str(e)}")
            return {
                "success": False,
                "message": f"Error deleting file: {str(e)}"
            }

def get_storage_service() -> StorageService:
    """
    Get the storage service instance
    
    Returns:
        StorageService: Storage service instance
    """
    return StorageService()