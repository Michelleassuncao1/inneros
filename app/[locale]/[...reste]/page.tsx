// Toute adresse inconnue sous une langue affiche la page introuvable traduite (not-found.tsx).
import { notFound } from "next/navigation";

export default function AdresseInconnue() {
  notFound();
}
