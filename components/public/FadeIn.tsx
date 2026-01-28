import { JSX } from 'solid-js';
import { Motion } from 'solid-motionone';

interface FadeInProps {
    children: JSX.Element;
    delay?: number;
    class?: string;
    once?: boolean;
    margin?: string;
}

export const FadeIn = (props: FadeInProps): JSX.Element => (
    <Motion.div
        initial={{ opacity: 0, y: 10 }}
        inView={{ opacity: 1, y: 0 }}
        inViewOptions={{
            once: props.once ?? true,
            margin: props.margin ?? "-50px"
        }}
        transition={{
            duration: 0.6,
            delay: props.delay ?? 0,
            easing: "ease-out"
        }}
        class={props.class ?? ""}
    >
        {props.children}
    </Motion.div>
);
