import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Facebook, Instagram, Linkedin, Mail, MapPin, Phone, Youtube } from "lucide-react";
import { siteContentQuery } from "@/lib/queries";
import { LogoMark } from "./Logo";

export function SiteFooter() {
  const { data } = useQuery(siteContentQuery);
  const contact = data?.contact;
  const social = data?.social;
  
  // Updated fallback details
  const phone = contact?.phone || "+13432969450";
  const email = contact?.email || "dereknash@usa.com";
  const address = contact?.address || "Quebec, Canada";

  const socials = [
    { href: social?.facebook, icon: Facebook, label: "Facebook" },
    { href: social?.instagram, icon: Instagram, label: "Instagram" },
    { href: social?.linkedin, icon: Linkedin, label: "LinkedIn" },
    { href: social?.youtube, icon: Youtube, label: "YouTube" },
  ].filter((s) => s.href);
  
  return (
    <footer className="bg-forest-gradient text-forest-foreground">
      <div className="container-page grid gap-10 py-16 md:grid-cols-[1.4fr_1fr_1fr_1.2fr]">
        <div>
          <div className="flex items-center gap-2.5">
            <LogoMark />
            <span className="font-display text-xl">Steve <span className="italic">Safari</span></span>
          </div>
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-forest-foreground/75">
            Guiding Kenyan applicants towards sponsored work in Canada, transparently, one stage at a time.
          </p>
          {socials.length > 0 && (
            <div className="mt-5 flex gap-3">
              {socials.map((s) => (
                <a key={s.label} href={s.href} target="_blank" rel="noreferrer" aria-label={s.label} className="rounded-full border border-forest-foreground/25 p-2 hover:bg-forest-foreground/10">
                  <s.icon className="h-4 w-4" />
                </a>
              ))}
            </div>
          )}
        </div>
        <div>
          <p className="eyebrow text-gold">Programme</p>
          <ul className="mt-4 space-y-2.5 text-sm text-forest-foreground/80">
            <li><Link to="/about" className="hover:text-forest-foreground">About us</Link></li>
            <li><Link to="/register" className="hover:text-forest-foreground">Register</Link></li>
            <li><Link to="/status" className="hover:text-forest-foreground">Check status</Link></li>
            <li><Link to="/testimonials" className="hover:text-forest-foreground">Testimonials</Link></li>
            <li><Link to="/team" className="hover:text-forest-foreground">Our team</Link></li>
            <li><Link to="/support" className="hover:text-forest-foreground">Help &amp; support</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-gold">Member lists</p>
          <ul className="mt-4 space-y-2.5 text-sm text-forest-foreground/80">
            <li><Link to="/members" className="hover:text-forest-foreground">Registered members</Link></li>
            <li><Link to="/sponsorship" className="hover:text-forest-foreground">Approved sponsorship</Link></li>
            <li><Link to="/flight-waiting-list" className="hover:text-forest-foreground">Flight waiting list</Link></li>
            <li><Link to="/alumni" className="hover:text-forest-foreground">Alumni</Link></li>
          </ul>
        </div>
        <div>
          <p className="eyebrow text-gold">Contact</p>
          <ul className="mt-4 space-y-3 text-sm text-forest-foreground/80">
            <li className="flex gap-2">
              <Phone className="mt-0.5 h-4 w-4 shrink-0" />
              {phone}
            </li>
            <li className="flex gap-2">
              <Mail className="mt-0.5 h-4 w-4 shrink-0" />
              {email}
            </li>
            <li className="flex gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              {address}
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-forest-foreground/15">
        <div className="container-page flex flex-col gap-3 py-6 text-xs text-forest-foreground/65 md:flex-row md:items-center md:justify-between">
          <p>
            KES 500 is the only registration fee. Registration does not guarantee sponsorship, flights, visas or programme acceptance.
          </p>
          <div className="flex gap-5">
            <Link to="/terms" className="hover:text-forest-foreground">Terms</Link>
            <Link to="/privacy" className="hover:text-forest-foreground">Privacy</Link>
            <Link to="/auth" className="hover:text-forest-foreground">Staff sign in</Link>
            <span>© {new Date().getFullYear()} Steve Safari</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
