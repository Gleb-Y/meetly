// import React, { useEffect, useRef } from "react";
// import { Animated, Image } from "react-native";

// export const AnimatedEventMarker = ({ icon, isSelected }) => {
//   const bounce = useRef(new Animated.Value(1)).current;

//   useEffect(() => {
//     Animated.sequence([
//       Animated.timing(bounce, {
//         toValue: 1.15,
//         duration: 150,
//         useNativeDriver: true,
//       }),
//       Animated.spring(bounce, {
//         toValue: 1,
//         friction: 5,
//         tension: 80,
//         useNativeDriver: true,
//       }),
//     ]).start();
//   }, [isSelected]);

//   return (
//     <Animated.View style={{ transform: [{ scale: bounce }] }}>
//       <Image source={icon} style={{ width: 56, height: 56 }} />
//     </Animated.View>
//   );
// };
