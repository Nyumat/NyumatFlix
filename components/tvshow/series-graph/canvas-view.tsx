"use client";

import {
  Background,
  Controls,
  ReactFlow,
  type Node,
  type NodeProps,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useMemo } from "react";
import {
  getRatingColor,
  getTextColorForBackground,
  type SeasonRatings,
} from "./types";

type EpisodeNodeData = {
  rating: number;
  name: string;
  seasonNumber: number;
  episodeNumber: number;
};

type LabelNodeData = {
  label: string;
};

type GridlineNodeData = {
  orientation: "horizontal" | "vertical";
  length: number;
};

type EpisodeNode = Node<EpisodeNodeData, "episode">;
type LabelNode = Node<LabelNodeData, "label">;
type GridlineNode = Node<GridlineNodeData, "gridline">;
type CanvasNode = EpisodeNode | LabelNode | GridlineNode;

const nodeWidth = 60;
const nodeHeight = 50;
const cellWidth = 48;
const cellHeight = 32;
const labelOffset = 30;

function EpisodeNodeComponent({ data }: NodeProps<EpisodeNode>) {
  const bgColor = getRatingColor(data.rating);
  const textColor = getTextColorForBackground(data.rating);

  return (
    <div
      className="w-12 h-8 rounded flex items-center justify-center"
      style={{ backgroundColor: bgColor }}
    >
      <span style={{ color: textColor }} className="text-sm font-bold">
        {data.rating.toFixed(1)}
      </span>
    </div>
  );
}

function LabelNodeComponent({ data }: NodeProps<LabelNode>) {
  return (
    <div className="text-xs text-muted-foreground font-medium whitespace-nowrap">
      {data.label}
    </div>
  );
}

function GridlineNodeComponent({ data }: NodeProps<GridlineNode>) {
  const isHorizontal = data.orientation === "horizontal";

  return (
    <div
      className="bg-white/10"
      style={{
        width: isHorizontal ? data.length : 1,
        height: isHorizontal ? 1 : data.length,
      }}
    />
  );
}

const nodeTypes: NodeTypes = {
  episode: EpisodeNodeComponent,
  label: LabelNodeComponent,
  gridline: GridlineNodeComponent,
} as const;

function seasonsToNodes(seasons: SeasonRatings[]): CanvasNode[] {
  const nodes: CanvasNode[] = [];

  const maxEpisodes = Math.max(...seasons.map((s) => s.episodes.length), 0);
  const seasonCount = seasons.length;

  if (seasonCount === 0 || maxEpisodes === 0) {
    return nodes;
  }

  const totalWidth = maxEpisodes * nodeWidth;
  const totalHeight = seasonCount * nodeHeight;

  for (let i = 0; i < maxEpisodes; i++) {
    nodes.push({
      id: `label-e${i + 1}`,
      type: "label",
      position: { x: i * nodeWidth + 17, y: -labelOffset },
      data: { label: `E${i + 1}` },
      draggable: false,
      selectable: false,
    });
  }

  seasons.forEach((season, sIdx) => {
    nodes.push({
      id: `label-s${season.seasonNumber}`,
      type: "label",
      position: { x: -labelOffset, y: sIdx * nodeHeight + 8 },
      data: { label: `S${season.seasonNumber}` },
      draggable: false,
      selectable: false,
    });
  });

  for (let row = 0; row <= seasonCount; row++) {
    const yPos =
      row * nodeHeight + cellHeight / 2 + (nodeHeight - cellHeight) / 2;
    nodes.push({
      id: `gridline-h-${row}`,
      type: "gridline",
      position: { x: -13, y: yPos - 10 },
      data: {
        orientation: "horizontal",
        length: totalWidth,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  }

  for (let col = 0; col <= maxEpisodes; col++) {
    const xPos = col * nodeWidth + cellWidth / 2 + (nodeWidth - cellWidth) / 2;
    nodes.push({
      id: `gridline-v-${col}`,
      type: "gridline",
      position: { x: xPos - 7, y: -13 },
      data: {
        orientation: "vertical",
        length: totalHeight,
      },
      draggable: false,
      selectable: false,
      zIndex: -1,
    });
  }

  seasons.forEach((season, sIdx) => {
    season.episodes.forEach((ep) => {
      if (ep.rating === undefined || ep.rating === null) {
        return;
      }
      nodes.push({
        id: `s${season.seasonNumber}-e${ep.episodeNumber}`,
        type: "episode",
        position: {
          x: (ep.episodeNumber - 1) * nodeWidth,
          y: sIdx * nodeHeight,
        },
        data: {
          rating: ep.rating,
          name: ep.name,
          seasonNumber: season.seasonNumber,
          episodeNumber: ep.episodeNumber,
        },
        draggable: false,
        selectable: false,
      });
    });
  });

  return nodes;
}

type CanvasViewProps = {
  seasons: SeasonRatings[];
};

export function CanvasView({ seasons }: CanvasViewProps) {
  const nodes = useMemo(() => seasonsToNodes(seasons), [seasons]);

  return (
    <div className="h-[400px] w-full rounded-lg border border-white/10 overflow-hidden">
      <ReactFlow
        nodes={nodes}
        nodeTypes={nodeTypes}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        fitView
        minZoom={0.1}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} />
        {/* <MiniMap
          TBD on this
          nodeColor={(node) => {
            if (node.type === "label") return "transparent";
            const data = node.data as EpisodeNodeData;
            return getRatingColor(data.rating);
          }}
          className="!bg-black/80 !border-white/10 !rounded-lg"
          style={{ width: 100, height: 70 }}
          position="top-left"
        /> */}
        <Controls
          className="!bg-black/80 !border-white/10 !rounded-lg [&>button]:!bg-black/60 [&>button]:!border-white/10 [&>button]:!text-white [&>button:hover]:!bg-white/20"
          showInteractive={false}
        />
      </ReactFlow>
    </div>
  );
}
