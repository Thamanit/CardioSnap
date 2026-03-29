import { HeartPulse, BookHeart, type LucideProps } from "lucide-react";

export const Icons = {
  logo: (props: LucideProps) => <HeartPulse {...props} />,
  cardiacSummary: (props: LucideProps) => <BookHeart {...props} />
};
