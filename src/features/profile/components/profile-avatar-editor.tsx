import { useEffect, useState } from 'react';
import { Check, ImagePlus, LockKeyhole, UserRound } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '../../../components/ui/avatar';
import { Button } from '../../../components/ui/button';
import { useAuth } from '../../../hooks/use-auth';
import { supabase } from '../../../lib/supabase';
import { getProfileAvatarIndex, getProfileAvatarUrl, PROFILE_AVATAR_OPTIONS } from '../../../lib/profile-avatar';
import { toast } from 'sonner';

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const MAX_COMPRESSED_BYTES = 96 * 1024;

async function createAvatarDataUrl(file: File): Promise<string> {
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
    throw new Error('Usá una imagen PNG, JPG o WebP.');
  }
  if (file.size > MAX_UPLOAD_BYTES) {
    throw new Error('La imagen debe pesar menos de 5 MB.');
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 256 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext('2d');
  if (!context) throw new Error('No se pudo procesar la imagen.');
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/webp', 0.72));
  if (!blob || blob.size > MAX_COMPRESSED_BYTES) {
    throw new Error('La imagen no se pudo reducir lo suficiente. Probá con otra.');
  }

  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('No se pudo leer la imagen.'));
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'));
    reader.readAsDataURL(blob);
  });
}

/** Lets a user choose and persist one of the local profile avatar images. */
export function ProfileAvatarEditor() {
  const { user, profile, refreshProfile } = useAuth();
  const [isSaving, setIsSaving] = useState(false);
  const [selectedAvatar, setSelectedAvatar] = useState(() =>
    profile && getProfileAvatarIndex(profile.id, profile.onboarding_profile?.avatarIndex)
  );
  const [avatarImage, setAvatarImage] = useState<string | null>(null);
  const profileInitials = `${profile?.first_name?.[0] ?? ''}${profile?.last_name?.[0] ?? ''}`.toUpperCase();
  const initials = profileInitials.length > 0 ? profileInitials : 'FD';

  useEffect(() => {
    if (profile) {
      setSelectedAvatar(getProfileAvatarIndex(profile.id, profile.onboarding_profile?.avatarIndex));
      setAvatarImage(typeof profile.onboarding_profile?.avatarImage === 'string' ? profile.onboarding_profile.avatarImage : null);
    }
  }, [profile]);

  const handleImageSelection = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    try {
      setAvatarImage(await createAvatarDataUrl(file));
      toast.success('Foto lista. Guardá los cambios para aplicarla.');
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'No se pudo procesar la imagen.');
    }
  };

  const saveAvatar = async () => {
    if (!user || !profile || !selectedAvatar || isSaving) return;

    setIsSaving(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        onboarding_profile: {
          ...profile.onboarding_profile,
          avatarIndex: selectedAvatar,
          avatarImage,
        },
      })
      .eq('id', user.id);

    if (error) {
      toast.error('No se pudo actualizar el avatar.');
      setIsSaving(false);
      return;
    }

    await refreshProfile();
    toast.success('Avatar actualizado.');
    setIsSaving(false);
  };

  return (
    <section className="flex flex-col gap-5 border-y border-border py-5 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-4">
        <Avatar className="size-20 border border-border bg-muted">
          {selectedAvatar && <AvatarImage src={getProfileAvatarUrl(selectedAvatar, avatarImage)} alt="Tu avatar de perfil" />}
          <AvatarFallback><UserRound className="size-8" /></AvatarFallback>
        </Avatar>
        <div className="space-y-1">
          <h2 className="font-semibold">Tu avatar</h2>
          <p className="max-w-lg text-sm text-muted-foreground">
            Solo vos lo ves, salvo que publiques un artículo con permiso para hacerlo.
          </p>
          <p className="text-xs text-muted-foreground">PNG, JPG o WebP. Máximo 5 MB; se optimiza automáticamente.</p>
          <p className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
            <LockKeyhole className="size-3.5" aria-hidden="true" /> Visible para vos y en tus artículos autorizados
          </p>
        </div>
      </div>

      <div className="flex flex-col items-start gap-3">
        <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Elegir avatar">
          {PROFILE_AVATAR_OPTIONS.map((avatarIndex) => (
            <Button
              key={avatarIndex}
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Elegir avatar ${avatarIndex}`}
              aria-pressed={!avatarImage && selectedAvatar === avatarIndex}
              onClick={() => {
                setSelectedAvatar(avatarIndex);
                setAvatarImage(null);
              }}
              className={!avatarImage && selectedAvatar === avatarIndex ? 'border-primary ring-2 ring-primary/30' : ''}
            >
              <Avatar className="size-9">
                <AvatarImage src={getProfileAvatarUrl(avatarIndex)} alt="" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
            </Button>
          ))}
          <Button asChild type="button" variant="outline">
            <label>
              <ImagePlus className="mr-2 size-4" aria-hidden="true" />
              Subir foto
              <input type="file" accept="image/png,image/jpeg,image/webp" className="sr-only" onChange={(event) => void handleImageSelection(event)} />
            </label>
          </Button>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" onClick={() => void saveAvatar()} disabled={isSaving || !selectedAvatar}>
            <Check className="mr-2 size-4" aria-hidden="true" />
            {isSaving ? 'Guardando...' : 'Guardar avatar'}
          </Button>
          {avatarImage && (
            <Button type="button" variant="ghost" onClick={() => setAvatarImage(null)}>
              Usar avatar ilustrado
            </Button>
          )}
        </div>
      </div>
    </section>
  );
}