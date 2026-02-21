/**
 * Vision Mobile Node - Onboarding Screen
 *
 * Swipeable intro slides for new users explaining key features:
 * 1. Welcome to Vision Node
 * 2. Earn VCN Rewards
 * 3. Verify Blocks
 * 4. Get Started
 */

import React, { useRef, useState } from 'react';
import {
    View,
    Text,
    StyleSheet,
    Dimensions,
    TouchableOpacity,
    FlatList,
    StatusBar,
    Animated,
} from 'react-native';

const { width, height } = Dimensions.get('window');

interface Props {
    onComplete: () => void;
}

interface Slide {
    id: string;
    title: string;
    subtitle: string;
    description: string;
    iconLines: { rotate: string; color: string; top: number; left: number }[];
    accentColor: string;
}

const SLIDES: Slide[] = [
    {
        id: '1',
        title: 'Vision Node',
        subtitle: 'Welcome to the Network',
        description:
            'Your device becomes a vital part of the Vision Chain network. Help secure, verify, and relay blockchain data -- all from your pocket.',
        iconLines: [
            { rotate: '-25deg', color: '#a29bfe', top: 10, left: 20 },
            { rotate: '25deg', color: '#6c5ce7', top: 10, left: 38 },
        ],
        accentColor: '#6c5ce7',
    },
    {
        id: '2',
        title: 'Earn Rewards',
        subtitle: 'Passive VCN Income',
        description:
            'Stay online and contribute to the network. The longer your uptime and streak, the more VCN you earn. Claim rewards anytime.',
        iconLines: [
            { rotate: '0deg', color: '#00b894', top: 15, left: 22 },
            { rotate: '0deg', color: '#00b894', top: 25, left: 30 },
            { rotate: '0deg', color: '#00b894', top: 35, left: 38 },
        ],
        accentColor: '#00b894',
    },
    {
        id: '3',
        title: 'Verify Blocks',
        subtitle: 'Real-Time Validation',
        description:
            'On WiFi, your node verifies new blocks on the Vision Chain in real-time. Higher accuracy means higher hash rate and better rewards.',
        iconLines: [
            { rotate: '0deg', color: '#fdcb6e', top: 12, left: 15 },
            { rotate: '45deg', color: '#f39c12', top: 20, left: 35 },
            { rotate: '-45deg', color: '#fdcb6e', top: 32, left: 25 },
        ],
        accentColor: '#f39c12',
    },
    {
        id: '4',
        title: 'Get Started',
        subtitle: 'Create Your Account',
        description:
            'Sign up with your email to activate your node. Invite friends with your referral code and climb the leaderboard together.',
        iconLines: [
            { rotate: '0deg', color: '#a29bfe', top: 18, left: 25 },
            { rotate: '90deg', color: '#6c5ce7', top: 18, left: 25 },
        ],
        accentColor: '#6c5ce7',
    },
];

const OnboardingScreen: React.FC<Props> = ({ onComplete }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const flatListRef = useRef<FlatList>(null);
    const scrollX = useRef(new Animated.Value(0)).current;

    const handleNext = () => {
        if (currentIndex < SLIDES.length - 1) {
            flatListRef.current?.scrollToIndex({ index: currentIndex + 1 });
            setCurrentIndex(currentIndex + 1);
        } else {
            onComplete();
        }
    };

    const handleSkip = () => {
        onComplete();
    };

    const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
        if (viewableItems.length > 0) {
            setCurrentIndex(viewableItems[0].index || 0);
        }
    }).current;

    const renderSlide = ({ item, index }: { item: Slide; index: number }) => (
        <View style={[styles.slide, { width }]}>
            {/* Icon */}
            <View style={styles.iconContainer}>
                <View style={[styles.iconOuter, { borderColor: `${item.accentColor}40` }]}>
                    <View style={[styles.iconInner, { backgroundColor: `${item.accentColor}15` }]}>
                        {item.iconLines.map((line, i) => (
                            <View
                                key={i}
                                style={[
                                    styles.iconLine,
                                    {
                                        backgroundColor: line.color,
                                        transform: [{ rotate: line.rotate }],
                                        top: line.top,
                                        left: line.left,
                                    },
                                ]}
                            />
                        ))}
                    </View>
                </View>
                {/* Glow */}
                <View
                    style={[
                        styles.iconGlow,
                        { backgroundColor: `${item.accentColor}08` },
                    ]}
                />
            </View>

            {/* Text */}
            <Text style={styles.slideTitle}>{item.title}</Text>
            <Text style={[styles.slideSubtitle, { color: item.accentColor }]}>
                {item.subtitle}
            </Text>
            <Text style={styles.slideDescription}>{item.description}</Text>
        </View>
    );

    return (
        <View style={styles.container}>
            <StatusBar barStyle="light-content" backgroundColor="#06061a" />

            {/* Skip Button */}
            {currentIndex < SLIDES.length - 1 && (
                <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
                    <Text style={styles.skipText}>Skip</Text>
                </TouchableOpacity>
            )}

            {/* Slides */}
            <FlatList
                ref={flatListRef}
                data={SLIDES}
                renderItem={renderSlide}
                keyExtractor={(item) => item.id}
                horizontal
                pagingEnabled
                showsHorizontalScrollIndicator={false}
                onViewableItemsChanged={onViewableItemsChanged}
                viewabilityConfig={{ viewAreaCoveragePercentThreshold: 50 }}
                onScroll={Animated.event(
                    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
                    { useNativeDriver: false },
                )}
            />

            {/* Bottom Controls */}
            <View style={styles.bottomControls}>
                {/* Pagination Dots */}
                <View style={styles.pagination}>
                    {SLIDES.map((slide, index) => {
                        const inputRange = [
                            (index - 1) * width,
                            index * width,
                            (index + 1) * width,
                        ];
                        const dotWidth = scrollX.interpolate({
                            inputRange,
                            outputRange: [8, 24, 8],
                            extrapolate: 'clamp',
                        });
                        const dotOpacity = scrollX.interpolate({
                            inputRange,
                            outputRange: [0.3, 1, 0.3],
                            extrapolate: 'clamp',
                        });
                        return (
                            <Animated.View
                                key={slide.id}
                                style={[
                                    styles.dot,
                                    {
                                        width: dotWidth,
                                        opacity: dotOpacity,
                                        backgroundColor: SLIDES[currentIndex]?.accentColor || '#6c5ce7',
                                    },
                                ]}
                            />
                        );
                    })}
                </View>

                {/* Action Button */}
                <TouchableOpacity
                    style={[
                        styles.actionButton,
                        { backgroundColor: SLIDES[currentIndex]?.accentColor || '#6c5ce7' },
                    ]}
                    onPress={handleNext}
                    activeOpacity={0.8}>
                    <Text style={styles.actionButtonText}>
                        {currentIndex === SLIDES.length - 1 ? 'Get Started' : 'Next'}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#06061a',
    },
    skipButton: {
        position: 'absolute',
        top: 56,
        right: 24,
        zIndex: 10,
        paddingVertical: 6,
        paddingHorizontal: 16,
    },
    skipText: {
        fontSize: 15,
        color: '#7a7a9e',
        fontWeight: '600',
    },
    slide: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 40,
        paddingBottom: 120,
    },
    // Icon
    iconContainer: {
        marginBottom: 40,
        alignItems: 'center',
        justifyContent: 'center',
    },
    iconOuter: {
        width: 120,
        height: 120,
        borderRadius: 60,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    iconInner: {
        width: 80,
        height: 80,
        borderRadius: 40,
        position: 'relative',
    },
    iconLine: {
        position: 'absolute',
        width: 3,
        height: 20,
        borderRadius: 1.5,
    },
    iconGlow: {
        position: 'absolute',
        width: 200,
        height: 200,
        borderRadius: 100,
        zIndex: -1,
    },
    // Text
    slideTitle: {
        fontSize: 32,
        fontWeight: '800',
        color: '#ffffff',
        textAlign: 'center',
        letterSpacing: -0.5,
        marginBottom: 8,
    },
    slideSubtitle: {
        fontSize: 16,
        fontWeight: '600',
        textAlign: 'center',
        marginBottom: 20,
    },
    slideDescription: {
        fontSize: 15,
        color: '#7a7a9e',
        textAlign: 'center',
        lineHeight: 24,
    },
    // Bottom
    bottomControls: {
        position: 'absolute',
        bottom: 50,
        left: 0,
        right: 0,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    pagination: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 28,
        gap: 6,
    },
    dot: {
        height: 8,
        borderRadius: 4,
    },
    actionButton: {
        width: '100%',
        paddingVertical: 16,
        borderRadius: 14,
        alignItems: 'center',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 6,
    },
    actionButtonText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#ffffff',
        letterSpacing: 0.3,
    },
});

export default OnboardingScreen;
