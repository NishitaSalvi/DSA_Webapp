"use client";
import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";
import MediaPlayer from "./MediaPlayer";
import { ChevronFirst, RotateCcw } from "lucide-react";
import DraggableCard from "./DraggableCard";
import { Tooltip } from "@/components/ui/tooltip";
import { TooltipTrigger } from "@/components/ui/tooltip";
import { TooltipContent } from "@radix-ui/react-tooltip";
import { Button } from "@/components/ui/button";
import { Code } from "lucide-react";

interface SortState {
  array: number[];
  currentIndex: number;
  minIndex: number;
  sortedIndices: number[];
  completed: boolean; // Use `completed` instead of `isCompleted`
  initialArray: number[];
  currentLine: number;
}

interface SortingResult {
  message: string;
  originalArray: number[];
  sortedArray: number[];
  totalSteps: number;
}

interface SortStep {
  message: string;
  state: {
    array: number[];
    currentIndex: number;
    minIndex: number;
    sortedIndices: number[];
    initialArray: number[];
    completed: boolean; // Use `completed` instead of `isCompleted`
    
  };
  stepNumber: number;
}

interface SelectionSortVizProps {
  array: number[];
  speed: number;
}

const SelectionSortViz: React.FC<SelectionSortVizProps> = ({
  array,
  speed,
}) => {
  // if (!array || !Array.isArray(array)) {
  //   console.error('Invalid array prop:', array);
  //   return <div>Error: Invalid array prop</div>;
  // }

  const svgRef = useRef<SVGSVGElement | null>(null);
  const [state, setState] = useState<SortState>({
    array: array,
    currentIndex: 0,
    minIndex: 0,
    sortedIndices: [],
    completed: false,
    initialArray: array,
    currentLine: 0,
  });

  const arrayLength = state.array.length; // Safe to access now

  const [isAnimating, setIsAnimating] = useState<boolean>(false);
  const [comparingIndex, setComparingIndex] = useState<any | null>(null);
  const [swappingPairs, setSwappingPairs] = useState<{
    from: number;
    to: number;
  } | null>(null);
  const [showTooltip, setShowTooltip] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showRuntimeCode, setShowRuntimeCode] = useState(true);
  // const [currentLine, setCurrentLine] = useState<number | null>(null);
  const [countStep, setCountStep] = useState<number>(0);
  const [currentStep, setCurrentStep] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [totalSteps, setTotalSteps] = useState(0);

  const currentAlgo = `minIndex = 0;
for (let i = 0; i<n ; i++)
    for (let j = i ; j < n ; j++)
        if (arr[j] > arr[j+1])
            minIndex = j+1;

    swap(arr[j] , arr[j+1]);
`
  const width = 1450;
  const height = 450;
  const margin = {
    top:
      Math.max(...state.initialArray) <= 50
        ? 100 - Math.max(...state.initialArray) * 1
        : 60,
    right: 725 - arrayLength * 19 > 260 ? 725 - arrayLength * 19 : 260,
    bottom: 160,
    left: 725 - arrayLength * 19 > 260 ? 725 - arrayLength * 19 : 260,
  };
  const barPadding = 0.2;
  const tooltipWidth = 480;
  const tooltipHeight = 29;
  const explainLines = [`Set minimum index to 0`, `is ${state.array[state.currentIndex]} > ${state.array[comparingIndex]}`, `swapping ${state.array[state.minIndex]} with ${state.array[state.currentIndex]}`,`Sorting complete`];


  const centerX = width / 2;
  const buttonY = height - margin.bottom + 70;

  const handlePlay = async () => {
    if (currentStep === 0) {
      setCountStep(0);
      await resetSort();
    }
    setIsPlaying(true);
    setCurrentStep(countStep);
  };

  const handlePause = () => {
    setIsPlaying(false);
  };

  const handleSeek = async (step: number) => {
    const response = await fetch(
      `http://localhost:8080/api/sort/selection/step/${step}`
    );
    // console.log(step);
    
    const stepData = await response.json();
    setState(stepData.state);
    setCountStep(step);
    setCurrentStep(step);

    setIsPlaying(false);
  };

  useEffect(() => {
    const initializeNewArray = async () => {
      try {
        const response = await fetch(
          "http://localhost:8080/api/sort/selection/init",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              array: array,
            }),
          }
        );

        const newState: SortingResult = await response.json();
        setState((prev) => ({
          ...prev,
          array: newState.originalArray,
          initialArray: newState.originalArray,
          currentIndex: 0,
          minIndex: 0,
          sortedIndices: [],
          isCompleted: false,
        }));
        setTotalSteps(newState.totalSteps);
        setComparingIndex(null);
        setSwappingPairs(null);
      } catch (error) {
        // Handle any errors during initialization
        console.error("Error initializing new array:", error);
      }
    };

    // Call the initialization function
    initializeNewArray();
  }, [array]);

  useEffect(() => {
    const isComparing = comparingIndex !== null;

    if (!svgRef.current) return;

    const svg: d3.Selection<SVGSVGElement, unknown, null, undefined> =
      d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const xScale = d3
      .scaleBand()
      .domain(state.array.map((_, i) => i.toString()))
      .range([margin.left, width - margin.right])
      .padding(arrayLength <= 18 ? barPadding : 0.6);

    const yScale = d3
      .scaleLinear()
      .domain([0, d3.max(state.array) || 0])
      .range([height - margin.bottom, margin.top]);

    // Create gradient definitions
    const defs = svg.append("defs");

    const gradients: Record<string, [string, string]> = {
      default: ["#9CA3AF", "#4B5563"],
      current: ["#60A5FA", "#2563EB"],
      minimum: ["#FB923C", "#EA580C"],
      comparing: ["#FCD34D", "#F59E0B"],
      sorted: ["#4ADE80", "#16A34A"],
    };

    Object.entries(gradients).forEach(([key, [start, end]]) => {
      const gradient = defs
        .append("linearGradient")
        .attr("id", `gradient-${key}`)
        .attr("gradientTransform", "rotate(90)");

      gradient.append("stop").attr("offset", "0%").attr("stop-color", start);

      gradient.append("stop").attr("offset", "100%").attr("stop-color", end);
    });

    // Create bars with data join
    const bars = svg
      .selectAll<SVGGElement, number>(".bar")
      .data(state.array, (d, i) => `${d}-${i}`);

    // Handle enter selection
    const barsEnter = bars
      .enter()
      .append("g")
      .attr("class", "bar")
      .attr(
        "transform",
        (_, i) => `translate(${xScale(i.toString()) || 0}, 0)`
      );

    barsEnter
      .append("path")
      .attr("d", (d) => {
        const x = 0;
        const y = yScale(d + 2);
        const width = xScale.bandwidth();
        const barHeight = yScale.range()[0] - yScale(d + 2);
        const radius = 6;

        return arrayLength <= 18
          ? `
            M ${x + radius} ${y}
            L ${x + width - radius} ${y}
            Q ${x + width} ${y} ${x + width} ${y + radius}
            L ${x + width} ${y + barHeight}
            L ${x} ${y + barHeight}
            L ${x} ${y + radius}
            Q ${x} ${y} ${x + radius} ${y}
            Z
          `
          : `
            M ${x} ${y}
            L ${x + width} ${y}
            L ${x + width} ${y + barHeight}
            L ${x} ${y + barHeight}
            Z
          `;
      })
      .attr("clip-path", "polygon(0 0, 100% 0, 100% 100%, 0 100%)");

    // Create value labels in enter selection
    if (arrayLength <= 18) {
      barsEnter
        .append("text")
        .attr("class", "value-label")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", height - margin.bottom + 20)
        .attr("text-anchor", "middle")
        .attr("fill", "#4B5563")
        .attr("font-weight", "600")
        .text((d) => d);

      // Create index labels in enter selection
      barsEnter
        .append("text")
        .attr("class", "index-label")
        .attr("x", xScale.bandwidth() / 2)
        .attr("y", height - margin.bottom + 45)
        .attr("text-anchor", "middle")
        .attr("fill", "#6B7280")
        .attr("font-size", "16px")
        .text((_, i) => i);
    }

    // Merge enter + update selections
    const barsUpdate = barsEnter.merge(bars);

    // Add tooltip container aligned with the button
    const tooltipContainer = svg
      .append("g")
      .attr("class", "tooltip-container")
      .attr(
        "transform",
        `translate(${centerX - tooltipWidth / 2}, ${buttonY - 14})`
      )
      .style("opacity", showTooltip ? 1 : 0)
      .on("mouseleave", () => setShowTooltip(false));

    tooltipContainer
      .append("rect")
      .attr("width", tooltipWidth)
      .attr("height", tooltipHeight)
      .attr("rx", 8)
      .style("fill", "transparent");

    tooltipContainer
      .append("rect")
      .attr("width", tooltipWidth)
      .attr("height", tooltipHeight)
      .attr("rx", 8)
      .attr("fill", "white")
      .attr("stroke", "#E5E7EB")
      .attr("stroke-width", 1)
      .style("pointer-events", "none");

    // Smooth tooltip fade animation
    tooltipContainer
      .transition()
      .delay(100)
      .duration(200)
      .style("opacity", showTooltip ? 1 : 0);

    const legendData = [
      { label: "Unsorted", gradient: "default" },
      { label: "Current", gradient: "current" },
      { label: "Minimum", gradient: "minimum" },
      { label: "Comparing", gradient: "comparing" },
      { label: "Sorted", gradient: "sorted" },
    ];

    const legendWidth = tooltipWidth / legendData.length;

    legendData.forEach((item, i) => {
      const legendGroup = tooltipContainer
        .append("g")
        .attr("transform", `translate(${i * legendWidth + 20}, 10)`);

      legendGroup
        .append("rect")
        .attr("width", 14)
        .attr("height", 14)
        .attr("rx", 4)
        .attr("y", -3)
        .attr("fill", `url(#gradient-${item.gradient})`);

      legendGroup
        .append("text")
        .attr("x", 22)
        .attr("y", 8)
        .attr("fill", "#4B5563")
        .attr("font-size", "12px")
        .text(item.label);
    });

    // Add toggle button
    const buttonGroup = svg
      .append("g")
      .attr("class", "button-group")
      .attr(
        "transform",
        `translate(${showTooltip ? centerX - 260 : centerX}, ${buttonY})`
      )
      .style("cursor", "pointer")
      .on("mouseenter", () => setShowTooltip(true));

    // Add transition for button position
    buttonGroup
      .transition()
      .duration(200)
      .attr(
        "transform",
        `translate(${showTooltip ? centerX - 260 : centerX}, ${buttonY})`
      );

    buttonGroup
      .append("circle")
      .attr("r", 12)
      .attr("fill", "white")
      .attr("stroke", "#E5E7EB")
      .attr("stroke-width", 1);

    buttonGroup
      .append("text")
      .attr("x", 0)
      .attr("y", 1)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", "#4B5563")
      .attr("font-size", "14px")
      .attr("font-weight", "bold")
      .text(">");

    // Handle swapping animation with longer duration
    const getTargetX = (index: number) => {
      if (swappingPairs) {
        if (index === swappingPairs.from)
          return xScale(swappingPairs.to.toString());
        if (index === swappingPairs.to)
          return xScale(swappingPairs.from.toString());
      }
      return xScale(index.toString());
    };

    // Update bar positions with slower animation for swaps
    barsUpdate
      .transition()
      .duration(swappingPairs ? 1000 / speed : 500 / speed)
      .ease(d3.easeCubicInOut)
      .attr("transform", (_, i) => `translate(${getTargetX(i) || 0}, 0)`);

    // Update rectangles with preserved scale animation
    barsUpdate
      .select("path")
      .transition()
      .duration(500 / speed)
      .attr("fill", (_, i) => {
        if (state.sortedIndices.includes(i)) return "url(#gradient-sorted)";
        if (i === state.minIndex) return "url(#gradient-minimum)";
        if (i === state.currentIndex) return "url(#gradient-current)";
        if (i === comparingIndex) return "url(#gradient-comparing)";
        return "url(#gradient-default)";
      })
      .style("transform-origin", "center bottom")
      .attr("transform", (_, i) => {
        if (
          (i === comparingIndex || (i === state.minIndex && isComparing)) &&
          isComparing
        ) {
          const scale = 1.05;
          return `translate(${34 * scale}, 0) scale(${scale})`;
        }
        return "scale(1)";
      })
      .style("filter", (_, i) =>
        (i === comparingIndex ||
          (i === state.minIndex && comparingIndex !== null)) &&
        comparingIndex !== null
          ? "brightness(1.1) drop-shadow(0 4px 6px rgba(0,0,0,0.1))"
          : "drop-shadow(0 2px 4px rgba(0,0,0,0.1))"
      );

    // Update labels
    barsUpdate
      .select(".value-label")
      .transition()
      .duration(swappingPairs ? 1000 : 500)
      .ease(d3.easeCubicInOut)
      .attr("x", xScale.bandwidth() / 2)
      .text((d) => d);

    barsUpdate
      .select(".index-label")
      .transition()
      .duration(swappingPairs ? 1000 / speed : 500 / speed)
      .ease(d3.easeCubicInOut)
      .attr("x", xScale.bandwidth() / 2)
      .text((_, i) => i);

    // Remove any exiting elements
    bars
      .exit()
      .transition()
      .duration(500 / speed)
      .style("opacity", 0)
      .remove();
  }, [state, comparingIndex, swappingPairs, showTooltip, arrayLength, speed]);

  const sleep = (ms: number): Promise<void> =>
    new Promise((resolve) => setTimeout(resolve, ms));

  useEffect(() => {
    const runAnimation = async () => {
      if (isPlaying && !state.completed && !isAnimating) {
        await PlaySteps();

        // Matches your sleep duration
      }
    };

    if (isPlaying) {
      runAnimation();
    }

    if (currentStep == totalSteps - 1 && isPlaying) {
      setCurrentStep(0);
      // resetSort();
      handlePause();
    }
  }, [isPlaying, countStep, state.completed, isAnimating, currentStep]);

  const PlaySteps = async (): Promise<void> => {
    if (!isAnimating) {
      setIsAnimating(true);
      try {
        const response = await fetch(
          `http://localhost:8080/api/sort/selection/step/${countStep}`,
          {
            method: "GET",
            headers: {
              "Content-Type": "application/json",
            },
          }
        );

        const stepData = await response.json();

        const comparisons = [];
        for (let i = 0; i < arrayLength - 1; i++) {
          for (let j = i + 1; j < arrayLength; j++) {
            comparisons.push(j);
          }
          comparisons.push(0);
        }
        comparisons.push(0);
        comparisons.push(0);

        const swappingPairsList = [];
        swappingPairsList.push(0);
        for (let j = 0; j < arrayLength - 1; j++) {
          for (let i = j; i < array.length - 1; i++) {
            swappingPairsList.push(0);
          }
          swappingPairsList.push(1);
        }
        swappingPairsList.push(0);

        if (swappingPairsList[countStep] === 1) {
          if (state.array[state.currentIndex] !== state.array[state.minIndex]) {
            setSwappingPairs({
              from: state.currentIndex,
              to: state.minIndex,
            });
            await sleep(800 / speed);
            setSwappingPairs(null);
          }
        }

        setState((prev: SortState) => ({
          ...prev,
          array: stepData.state.array,
          currentIndex: stepData.state.currentIndex,
          minIndex: stepData.state.minIndex,
          sortedIndices: stepData.state.sortedIndices,
          completed: stepData.state.completed,
          initialArray: stepData.state.initialArray,
          currentLine: stepData.state.currentLine,
        }));

        if (comparisons[countStep] !== 0) {
          setComparingIndex(comparisons[countStep]);
        }

        setCurrentStep(countStep);
        await sleep(800 / speed);

        setComparingIndex(null);
        setCountStep((prev) => prev + 1);
      } catch (error) {
        console.error("Error during animation step:", error);
      } finally {
        setIsAnimating(false);
      }
    }
  };

  const nextStep = async (): Promise<void> => {
    if (isAnimating || state.completed) return;
    setIsAnimating(true);

    try {
      setCountStep((prev: number) => prev + arrayLength - state.currentIndex);
      setCurrentStep(countStep);
      let minIdx = state.currentIndex;

      setState((prev) => ({
        ...prev,
        minIndex: minIdx,
      }));

      for (let i = state.currentIndex + 1; i < state.array.length; i++) {
        setCurrentStep((prev) => prev + 1);
        setComparingIndex(i);
        await sleep(800 / speed);

        if (state.array[i] < state.array[minIdx]) {
          minIdx = i;
          setState((prev) => ({
            ...prev,
            minIndex: minIdx,
          }));
          await sleep(800 / speed);
        }
      }

      setComparingIndex(null);

      const response = await fetch(
        "http://localhost:8080/api/sort/selection/step",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            array: state.array,
            currentIndex: state.currentIndex,
            reset: false,
          }),
        }
      );

      const newState: SortState = await response.json();

      if (state.array[state.currentIndex] !== state.array[newState.minIndex]) {
        setSwappingPairs({
          from: state.currentIndex,
          to: newState.minIndex,
        });
        await sleep(800 / speed); // Longer pause during swap
        setSwappingPairs(null);
      }
      setCurrentStep((prev) => prev + 1);

      setState((prev) => ({
        ...newState,
        minIndex: newState.currentIndex,
        initialArray: [...prev.initialArray], // Use the initialArray to reset
      }));
    } catch (error) {
      console.error("Error during sorting step:", error);
    } finally {
      setIsAnimating(false);
    }
  };

  const previousStep = async (): Promise<void> => {
    if (isAnimating || state.currentIndex <= 0) return;
    setIsAnimating(true);

    try {
      const response = await fetch(
        `http://localhost:8080/api/sort/selection/step/${countStep - 1}`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      const newState: SortStep = await response.json();

      if (
        newState &&
        state.array[state.currentIndex - 1] !== state.array[state.minIndex]
      ) {
        setSwappingPairs({
          from: state.currentIndex - 1,
          to: newState.state.minIndex,
        });
        await sleep(800 / speed);
        setSwappingPairs(null);
      }

      if (newState) {
        setState((prev) => ({
          ...prev,
          array: newState.state.array,
          currentIndex: newState.state.currentIndex,
          minIndex: newState.state.currentIndex,
          sortedIndices: newState.state.sortedIndices,
          completed: newState.state.completed,
          initialArray: newState.state.initialArray,
        }));
      }

      setComparingIndex(null);
      setCountStep(
        (prev: number) => prev - arrayLength + (state.currentIndex - 1)
      );
      setCurrentStep(
        (prev: number) => prev - arrayLength + (state.currentIndex - 2)
      );
    } catch (error) {
      console.error("Error during previous step:", error);
    } finally {
      setIsAnimating(false);
    }
  };

  const resetSort = async (): Promise<void> => {
    setIsAnimating(true);
    setIsPlaying(false);

    try {
      const response = await fetch(
        "http://localhost:8080/api/sort/selection/step",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            array: state.initialArray,
            currentIndex: 0,
            reset: true,
          }),
        }
      );

      const newState: SortState = await response.json();

      setState((prev) => ({
        ...newState,
        initialArray: [...prev.initialArray], // Use the initialArray to reset
      }));
      setComparingIndex(null);
      setSwappingPairs(null);
      setCountStep(0);
      setCurrentStep(0);
    } catch (error) {
      console.error("Error resetting sort:", error);
    } finally {
      setIsAnimating(false);
    }
  };

  console.log("HELLLOOOOO")

  return (
    <>
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
      <svg ref={svgRef} width={width} height={height} className="" />
      </div>
      <div className="absolute bottom-[15vh]  bg-white p-2 rounded-lg shadow-md my-auto">
        <p>{state.currentLine == 0 ? explainLines[0] : state.currentLine == 3 ? explainLines[1]: state.currentLine == 6 ? explainLines[2] : explainLines[3] } </p>
      </div>
      <div className="flex gap-4 w-full justify-center bottom-0 fixed bg-black py-3 px-5 left-0">
        <button
          onClick={resetSort}
          className="px-2 py-1 h-10 w-10 bg-gradient-to-r from-gray-500 to-gray-600
                     text-white rounded-full shadow-md hover:from-gray-600
                     hover:to-gray-700 disabled:opacity-50
                     disabled:cursor-not-allowed"
        >
          <RotateCcw />
        </button>
        <button
          onClick={previousStep}
          disabled={isAnimating || state.currentIndex <= 0 || isPlaying}
          className="px-2 py-1 h-10 w-10 bg-gradient-to-r from-blue-500 to-blue-600
                     text-white rounded-full shadow-md hover:from-blue-600
                     hover:to-blue-700 disabled:opacity-50
                     disabled:cursor-not-allowed"
        >
          <ChevronFirst />
        </button>

        <MediaPlayer
          currentStep={currentStep}
          totalSteps={totalSteps}
          isPlaying={isPlaying}
          onPlay={handlePlay}
          onPause={handlePause}
          onSeek={handleSeek}
          nextStep={nextStep}
          isAnimating={isAnimating}
          state={state}
        />

        {/* Code Button */}
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              onClick={() => setShowCode(!showCode)}
              className="h-10 w-21 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-lg rounded-lg shadow-md hover:shadow-lg transition-all duration-200 ease-in-out transform hover:scale-105"
            >
              <Code className="h-6 w-6 mr-0" />
              Code
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Toggle Code View</p>
          </TooltipContent>
        </Tooltip>

        <DraggableCard
          showCode={showCode}
          showRuntimeCode={showRuntimeCode}
          currentAlgo={currentAlgo}
          currentLine={state.currentLine==3?[3,4]:state.currentLine}
        />
      </div>
    </div>
    </>
  );
};

export default SelectionSortViz;
