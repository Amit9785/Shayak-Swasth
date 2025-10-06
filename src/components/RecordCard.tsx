import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FileText, Image, Download, Eye, Share2, Trash2, Edit } from "lucide-react";

interface RecordCardProps {
  id: string;
  title: string;
  type: "pdf" | "image" | "report" | "dicom";
  uploadedBy: string;
  uploadDate: string;
  status: "processed" | "processing" | "pending";
  canDelete?: boolean;
  canShare?: boolean;
  canEdit?: boolean;
  onView?: () => void;
  onDownload?: () => void;
  onShare?: () => void;
  onDelete?: () => void;
  onEdit?: () => void;
}

const RecordCard = ({
  title,
  type,
  uploadedBy,
  uploadDate,
  status,
  canDelete = false,
  canShare = false,
  canEdit = false,
  onView,
  onDownload,
  onShare,
  onDelete,
  onEdit,
}: RecordCardProps) => {
  const getIcon = () => {
    switch (type) {
      case "pdf":
        return <FileText className="h-8 w-8 text-destructive" />;
      case "image":
        return <Image className="h-8 w-8 text-secondary" />;
      case "report":
        return <FileText className="h-8 w-8 text-primary" />;
      case "dicom":
        return <FileText className="h-8 w-8 text-accent" />;
      default:
        return <FileText className="h-8 w-8 text-muted-foreground" />;
    }
  };

  const getStatusColor = () => {
    switch (status) {
      case "processed":
        return "bg-secondary text-secondary-foreground";
      case "processing":
        return "bg-accent text-accent-foreground";
      case "pending":
        return "bg-muted text-muted-foreground";
      default:
        return "bg-muted";
    }
  };

  return (
    <Card className="hover:shadow-medium transition-all animate-fade-in">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            {getIcon()}
            <div>
              <CardTitle className="text-base">{title}</CardTitle>
              <p className="text-sm text-muted-foreground">{uploadedBy}</p>
            </div>
          </div>
          <Badge className={getStatusColor()}>
            {status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span>Uploaded: {uploadDate}</span>
        </div>
      </CardContent>
      <CardFooter className="flex gap-2">
        <Button size="sm" variant="outline" onClick={onView}>
          <Eye className="mr-1 h-4 w-4" />
          View
        </Button>
        <Button size="sm" variant="outline" onClick={onDownload}>
          <Download className="mr-1 h-4 w-4" />
          Download
        </Button>
        {canEdit && (
          <Button size="sm" variant="outline" onClick={onEdit}>
            <Edit className="mr-1 h-4 w-4" />
            Edit
          </Button>
        )}
        {canShare && (
          <Button size="sm" variant="outline" onClick={onShare}>
            <Share2 className="mr-1 h-4 w-4" />
            Share
          </Button>
        )}
        {canDelete && (
          <Button size="sm" variant="destructive" onClick={onDelete}>
            <Trash2 className="mr-1 h-4 w-4" />
            Delete
          </Button>
        )}
      </CardFooter>
    </Card>
  );
};

export default RecordCard;

// Ashmit contribution
