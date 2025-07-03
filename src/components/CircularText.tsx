import React, { useEffect, useCallback } from "react";
import {
  motion,
  useAnimation,
  useMotionValue,
  MotionValue,
  Transition,
} from "framer-motion";

interface CircularTextProps {
  text: string;
  spinDuration?: number;
  onHover?: "slowDown" | "speedUp" | "pause" | "goBonkers";
  className?: string;
  radius?: number;
}

const getRotationTransition = (
  duration: number,
  from: number,
  loop: boolean = true
) => ({
  from,
  to: from + 360,
  ease: "linear" as const,
  duration,
  type: "tween" as const,
  repeat: loop ? Infinity : 0,
});

const getTransition = (duration: number, from: number) => ({
  rotate: getRotationTransition(duration, from),
  scale: {
    type: "spring" as const,
    damping: 20,
    stiffness: 300,
  },
});

const CircularText: React.FC<CircularTextProps> = ({
  text,
  spinDuration = 20,
  onHover = "speedUp",
  className = "",
  radius = 120,
}) => {
  const letters = Array.from(text);
  const controls = useAnimation();
  const rotation: MotionValue<number> = useMotionValue(0);

  const startAnimation = useCallback(
    (config: any) => {
      const start = rotation.get();
      controls
        .start({
          ...config.animate,
          transition: config.transition,
        })
        .catch((error) => {
          // Only suppress specific animation interruption errors, log others
          if (
            error?.message &&
            !error.message.includes("Animation cancelled")
          ) {
            console.warn("CircularText animation error:", error);
          }
        });
    },
    [controls, rotation]
  );

  useEffect(() => {
    startAnimation({
      animate: {
        rotate: rotation.get() + 360,
        scale: 1,
      },
      transition: getTransition(spinDuration, rotation.get()),
    });
  }, [spinDuration, text, onHover, startAnimation, rotation]);

  const handleHoverStart = useCallback(() => {
    if (!onHover) return;

    let config: {
      animate: any;
      transition: ReturnType<typeof getTransition> | Transition;
    } = {
      animate: {
        rotate: rotation.get() + 360,
        scale: 1,
      },
      transition: getTransition(spinDuration, rotation.get()),
    };

    switch (onHover) {
      case "slowDown":
        config.transition = getTransition(spinDuration * 2, rotation.get());
        break;
      case "speedUp":
        config.transition = getTransition(spinDuration / 4, rotation.get());
        break;
      case "pause":
        config.transition = {
          rotate: { type: "spring", damping: 20, stiffness: 300 },
          scale: { type: "spring", damping: 20, stiffness: 300 },
        };
        break;
      case "goBonkers":
        config = {
          animate: {
            rotate: [
              rotation.get(),
              rotation.get() + 45,
              rotation.get() - 45,
              rotation.get() + 360,
            ],
            scale: [1, 0.95, 0.95, 1],
          },
          transition: {
            rotate: {
              duration: spinDuration / 2,
              times: [0, 0.2, 0.4, 1],
              ease: "easeInOut",
              repeat: 0,
            },
            scale: {
              duration: spinDuration / 2,
              times: [0, 0.2, 0.8, 1],
              ease: "easeInOut",
              repeat: 0,
            },
          },
        };
        break;
    }

    startAnimation(config);
  }, [onHover, spinDuration, startAnimation, rotation]);

  const handleHoverEnd = useCallback(() => {
    startAnimation({
      animate: {
        rotate: rotation.get() + 360,
        scale: 1,
      },
      transition: {
        rotate: {
          duration: spinDuration / 2,
          ease: "easeOut",
        },
        scale: {
          duration: spinDuration / 4,
          ease: "easeOut",
        },
      },
    });
  }, [spinDuration, startAnimation, rotation]);

  return (
    <motion.div
      className={`relative ${className}`}
      style={{
        width: `${radius * 2}px`,
        height: `${radius * 2}px`,
        rotate: rotation,
      }}
      initial={{ rotate: 0 }}
      animate={controls}
      onMouseEnter={handleHoverStart}
      onMouseLeave={handleHoverEnd}
    >
      <div
        className="absolute w-full h-full"
        style={{
          color: "var(--text-primary)",
        }}
      >
        {letters.map((letter, i) => {
          const rotationDeg = (360 / letters.length) * i;
          const transform = `rotate(${rotationDeg}deg) translateY(-${radius}px)`;

          return (
            <span
              key={i}
              className="absolute top-1/2 left-1/2 origin-[0_0] text-5xl font-bold uppercase font-thunder"
              style={{
                transform,
                WebkitTransform: transform,
                transformOrigin: "0 0",
                willChange: "transform",
              }}
            >
              {letter}
            </span>
          );
        })}
      </div>
    </motion.div>
  );
};

export default CircularText;
