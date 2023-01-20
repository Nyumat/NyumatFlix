import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { useRouter } from "next/router";

interface TransitionProps {
  children: React.ReactNode;
}

const variants = {
  in: {
    scale: 0.8,
    y: 100,
    x: "100%",
    transition: {
      duration: 0.4,
    },
  },
  center: {
    x: 0,
    scale: 0.8,
    transformOrigin: "top",
    transition: {
      duration: 0.4,
    },
  },
  scaleUp: {
    scale: 1,
    y: 0,
    transition: {
      duration: 0.4,
      delay: 0.5,
    },
  },
  scaleDown: {
    scale: 0.8,
    y: 100,
    transition: {
      duration: 0.4,
    },
  },
  out: {
    opacity: 0,
    x: "-100%",
    transition: {
      duration: 0.4,
      delay: 0.5,
    },
  },
};

export default function PopOutTransition({ children }: TransitionProps) {
  const { asPath } = useRouter();
  const shouldReduceMotion = useReducedMotion();

  return (
    <div className="effect-3">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={asPath}
          variants={!shouldReduceMotion ? variants : undefined}
          initial="in"
          animate={["center", "scaleUp"]}
          exit={["scaleDown", "out"]}
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
