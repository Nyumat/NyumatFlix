import { motion, AnimatePresence } from "framer-motion";
import { useRouter } from "next/router";

interface TransitionProps {
  children: React.ReactNode;
}

const variants = {
  out: {
    opacity: 0,
    y: 40,
    transition: {
      duration: 1.0,
    },
  },
  in: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.75,
      delay: 1.75,
    },
  },
};

export default function Transition({ children }: TransitionProps) {
  const { asPath } = useRouter();

  return (
    <div className="effect-1">
      <AnimatePresence initial={false} mode="popLayout">
        <motion.div
          key={asPath}
          variants={variants}
          animate="in"
          initial="out"
          exit="out"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
