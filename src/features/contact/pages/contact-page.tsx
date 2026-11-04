// src/features/contact/pages/contact-page.tsx

import React from 'react';
import { motion } from 'framer-motion';
import { Mail, Send, Twitter, Linkedin, Github, Instagram } from 'lucide-react';
import { toast } from 'sonner';
import { useConfig } from '../../../hooks/use-config';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Label } from '../../../components/ui/label';
import { Textarea } from '../../../components/ui/textarea';
import { Button } from '../../../components/ui/button';
import { logger } from '../../../lib/logger';
import { contactService } from '../../../services/contact-service';

/**
 * Página de contacto.
 * Muestra un formulario para que los usuarios puedan enviar mensajes
 * y la información de contacto de la aplicación.
 * 
 * @example
 * ```tsx
 * <Route path="/contact" element={<ContactPage />} />
 * ```
 */
export default function ContactPage() {
  const config = useConfig();
  const [loading, setLoading] = React.useState(false);
  const [formData, setFormData] = React.useState({
    name: '',
    email: '',
    message: '',
  });

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.message) {
      toast.error('Por favor completa todos los campos.');
      return;
    }

    if (formData.message.length < 10) {
      toast.error('El mensaje debe tener al menos 10 caracteres.');
      return;
    }

    setLoading(true);

    void (async () => {
      try {
        // Log del contacto
        await logger.info('CONTACT_FORM_SUBMITTED', 'Contact form submitted', {
          name: formData.name,
          email: formData.email,
          messageLength: formData.message.length,
        });

        // Enviar mensaje usando el servicio
        const result = await contactService.sendContactMessage(formData);

        if (!result.success) {
          toast.error(result.error ?? 'Error al enviar el mensaje.');
          return;
        }

        // Mensaje enviado correctamente
        toast.success('¡Mensaje enviado correctamente!');
        toast.info('Nos pondremos en contacto contigo pronto. Normalmente respondemos en menos de 24 horas.', {
          duration: 5000,
        });

        // Limpiar formulario
        setFormData({ name: '', email: '', message: '' });
      } catch (error) {
        await logger.error('CONTACT_FORM_ERROR', 'Error submitting contact form', {
          errorMessage: error instanceof Error ? error.message : String(error),
        });
        toast.error('Error al enviar el mensaje. Por favor, intentá de nuevo o contáctanos directamente por email.');
      } finally {
        setLoading(false);
      }
    })();
  };

  const socialLinks = [
    {
      name: 'Twitter',
      icon: Twitter,
      url: config.app.socialMedia?.twitter,
    },
    {
      name: 'LinkedIn',
      icon: Linkedin,
      url: config.app.socialMedia?.linkedin,
    },
    {
      name: 'GitHub',
      icon: Github,
      url: config.app.socialMedia?.github,
    },
    {
      name: 'Instagram',
      icon: Instagram,
      url: config.app.socialMedia?.instagram,
    },
  ];

  return (
    <div className="container-wide space-y-4 sm:space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="space-y-6 sm:space-y-8"
      >
        {/* Header */}
        <div className="text-center space-y-1.5 sm:space-y-2">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold tracking-tight">Contacto</h1>
          <p className="text-sm sm:text-base text-muted-foreground max-w-2xl mx-auto px-4">
            ¿Tienes alguna pregunta o sugerencia? Nos encantaría escucharte.
            Completa el formulario o contáctanos directamente.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
          {/* Formulario de contacto */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                <Send className="h-4 w-4 sm:h-5 sm:w-5" />
                Envíanos un mensaje
              </CardTitle>
              <CardDescription className="text-xs sm:text-sm">
                Completa el formulario y te responderemos lo antes posible.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="name" className="text-sm">Nombre</Label>
                  <Input
                    id="name"
                    name="name"
                    placeholder="Tu nombre"
                    value={formData.name}
                    onChange={handleChange}
                    required
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="email" className="text-sm">Correo Electrónico</Label>
                  <Input
                    id="email"
                    name="email"
                    type="email"
                    placeholder="tu@email.com"
                    value={formData.email}
                    onChange={handleChange}
                    required
                    className="text-sm"
                  />
                </div>

                <div className="space-y-1.5 sm:space-y-2">
                  <Label htmlFor="message" className="text-sm">Mensaje</Label>
                  <Textarea
                    id="message"
                    name="message"
                    placeholder="Escribí tu mensaje aquí..."
                    rows={5}
                    value={formData.message}
                    onChange={handleChange}
                    required
                    className="resize-none text-sm"
                  />
                  <p className="text-xs text-muted-foreground">
                    Mínimo 10 caracteres
                  </p>
                </div>

                <Button type="submit" className="w-full text-sm" disabled={loading} size="sm">
                  {loading ? 'Enviando...' : 'Enviar Mensaje'}
                </Button>
              </form>
            </CardContent>
          </Card>

          {/* Información de contacto */}
          <div className="space-y-4 sm:space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
                  <Mail className="h-4 w-4 sm:h-5 sm:w-5" />
                  Información de Contacto
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 sm:space-y-4">
                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-1.5 sm:mb-2">Email</h3>
                  <a
                    href={`mailto:${config.app.contactEmail}`}
                    className="text-sm text-primary hover:underline break-all"
                  >
                    {config.app.contactEmail}
                  </a>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-1.5 sm:mb-2">Horario de Atención</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Lunes a Viernes: 9:00 AM - 6:00 PM (ART)
                  </p>
                </div>

                <div>
                  <h3 className="text-sm sm:text-base font-semibold mb-1.5 sm:mb-2">Tiempo de Respuesta</h3>
                  <p className="text-xs sm:text-sm text-muted-foreground">
                    Normalmente respondemos en menos de 24 horas hábiles.
                  </p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Síguenos en Redes Sociales</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex gap-3 sm:gap-4">
                  {socialLinks.map((social) => {
                    const Icon = social.icon;
                    return social.url ? (
                      <a
                        key={social.name}
                        href={social.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
                        aria-label={social.name}
                      >
                        <Icon className="h-4 w-4 sm:h-5 sm:w-5" />
                      </a>
                    ) : null;
                  })}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg sm:text-xl">Preguntas Frecuentes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  ¿Tienes dudas sobre los planes, características o cómo usar la
                  plataforma? Consulta nuestra{' '}
                  <a href="/plans" className="text-primary hover:underline">
                    página de planes
                  </a>{' '}
                  para más información.
                </p>
              </CardContent>
            </Card>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
