import { AnimatePresence, motion } from "framer-motion";
interface TransitionProps {
  children: React.ReactNode;
}

const variants = {
  fadeIn: {
    y: 100,
    opacity: 0,
    transition: {
      duration: 1,
      ease: "easeInOut",
    },
  },
  inactive: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 1,
      ease: "easeInOut",
    },
  },
  fadeOut: {
    opacity: 0,
    y: -100,
    transition: {
      duration: 1,
      ease: "easeInOut",
    },
  },
};

export default function UpUpTransition({ children }: TransitionProps) {
  return (
    <div className="effect-2">
      <AnimatePresence initial={false} mode="wait">
        <motion.div
          key={null}
          variants={variants}
          initial="fadeIn"
          animate="inactive"
          exit="fadeOut"
        >
          {children}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
