// src/features/blog/components/blog-comments.tsx
import { Avatar, AvatarFallback } from '../../../components/ui/avatar';
import { Card } from '../../../components/ui/card';
import { MessageCircle } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';

interface Comment {
  id: string;
  content: string;
  created_at: string;
  author: {
    first_name: string;
    last_name: string;
  };
  parent_comment_id?: string | null;
}

interface BlogCommentsProps {
  comments: Comment[];
}

function CommentItem({ comment, allComments, depth = 0 }: { comment: Comment; allComments: Comment[]; depth?: number }) {
  const authorName = `${comment.author.first_name} ${comment.author.last_name}`.trim();
  const initials = `${comment.author.first_name[0]}${comment.author.last_name?.[0] || ''}`.toUpperCase();
  
  // Obtener respuestas directas a este comentario
  const replies = allComments.filter(c => c.parent_comment_id === comment.id);
  
  return (
    <div className="space-y-2 sm:space-y-3">
      <Card className="p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-3">
          <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
            <AvatarFallback className="text-xs">{initials}</AvatarFallback>
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center gap-0.5 sm:gap-2 mb-1">
              <span className="font-semibold text-sm">{authorName}</span>
              <span className="text-xs text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true, locale: es })}
              </span>
            </div>
            
            <p className="text-sm whitespace-pre-wrap break-words leading-relaxed">{comment.content}</p>
            
          </div>
        </div>
      </Card>
      
      {/* Respuestas anidadas - recursivas con límite de profundidad visual */}
      {replies.length > 0 && (
        <div className={depth < 3 ? "ml-4 sm:ml-8 space-y-2 sm:space-y-3" : "ml-2 sm:ml-4 space-y-2 sm:space-y-3"}>
          {replies.map(reply => (
            <CommentItem
              key={reply.id}
              comment={reply}
              allComments={allComments}
              depth={depth + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function BlogComments({ comments }: BlogCommentsProps) {
  const mainComments = comments.filter(c => !c.parent_comment_id);

  return (
    <div className="mt-8 sm:mt-12 space-y-4 sm:space-y-6">
      <div className="flex items-center gap-2">
        <MessageCircle className="w-5 h-5 sm:w-6 sm:h-6" />
        <h2 className="text-xl sm:text-2xl font-bold">
          Comentarios {comments.length > 0 && `(${comments.length})`}
        </h2>
      </div>

      <div className="space-y-3 sm:space-y-4">
        {mainComments.length === 0 ? (
          <Card className="p-6 sm:p-8 text-center">
            <MessageCircle className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-2 sm:mb-3 text-muted-foreground" />
            <p className="text-sm sm:text-base text-muted-foreground">
              Todavía no hay comentarios en este artículo.
            </p>
          </Card>
        ) : (
          mainComments.map(comment => (
            <CommentItem key={comment.id} comment={comment} allComments={comments} />
          ))
        )}
      </div>
    </div>
  );
}
