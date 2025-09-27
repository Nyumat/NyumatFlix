"use client";

import { RotateCcw, Settings, Wifi, WifiOff } from "lucide-react";
import { useServerManagement } from "@/hooks/useServerManagement";
import { useServerStore, videoServers } from "@/lib/stores/server-store";
import { Badge } from "./badge";
import { Button } from "./button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "./dropdown-menu";
import { Input } from "./input";

interface ServerManagementProps {
  className?: string;
}

export function ServerManagement({ className }: ServerManagementProps) {
  const {
    serverOverrides,
    removeServerOverride,
    resetServerOverrides,
    getServerOverride,
    isServerOverridden,
  } = useServerStore();

  const {
    customReason,
    editingServerId,
    setCustomReason,
    setEditingServerId,
    handleToggleServer,
    handleCustomReason,
    getServerStatus,
  } = useServerManagement();

  const getServerStatusIcon = (serverId: string) => {
    const status = getServerStatus(serverId);
    return status === "available" ? (
      <Wifi className="h-4 w-4 text-green-600" />
    ) : (
      <WifiOff className="h-4 w-4 text-red-600" />
    );
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className={`gap-2 ${className}`}>
          <Settings className="h-4 w-4" />
          Server Management
          {serverOverrides.length > 0 && (
            <Badge variant="secondary" className="ml-1">
              {serverOverrides.length}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <DropdownMenuLabel>Manage Server Availability</DropdownMenuLabel>
        <DropdownMenuSeparator />

        {videoServers.map((server) => {
          const override = getServerOverride(server.id);
          const isEditing = editingServerId === server.id;

          return (
            <div key={server.id} className="p-2 border-b last:border-b-0">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  {getServerStatusIcon(server.id)}
                  <span className="font-medium">{server.name}</span>
                </div>
                <div className="flex items-center gap-1">
                  {isServerOverridden(server.id) && (
                    <Badge variant="outline" className="text-xs">
                      Override
                    </Badge>
                  )}
                </div>
              </div>

              {override && !override.isAvailable && (
                <div className="text-xs text-muted-foreground mb-2">
                  Reason: {override.reason || "No reason provided"}
                </div>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant={
                    getServerStatus(server.id) === "available"
                      ? "default"
                      : "outline"
                  }
                  size="sm"
                  onClick={() => handleToggleServer(server.id, true)}
                  className="text-xs"
                >
                  <Wifi className="h-3 w-3 mr-1" />
                  Available
                </Button>

                <Button
                  variant={
                    getServerStatus(server.id) === "unavailable"
                      ? "destructive"
                      : "outline"
                  }
                  size="sm"
                  onClick={() =>
                    handleToggleServer(server.id, false, "Server down")
                  }
                  className="text-xs"
                >
                  <WifiOff className="h-3 w-3 mr-1" />
                  Down
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (isEditing) {
                      setEditingServerId(null);
                      setCustomReason("");
                    } else {
                      setEditingServerId(server.id);
                      setCustomReason(override?.reason || "");
                    }
                  }}
                  className="text-xs"
                >
                  Custom
                </Button>

                {isServerOverridden(server.id) && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeServerOverride(server.id)}
                    className="text-xs"
                  >
                    Reset
                  </Button>
                )}
              </div>

              {isEditing && (
                <div className="flex items-center gap-2 mt-2">
                  <Input
                    placeholder="Enter reason..."
                    value={customReason}
                    onChange={(e) => setCustomReason(e.target.value)}
                    className="text-xs"
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        handleCustomReason(server.id);
                      }
                    }}
                  />
                  <Button
                    size="sm"
                    onClick={() => handleCustomReason(server.id)}
                    className="text-xs"
                  >
                    Set
                  </Button>
                </div>
              )}
            </div>
          );
        })}

        <DropdownMenuSeparator />

        <div className="p-2">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Quick Actions</span>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  videoServers.forEach((server) => {
                    removeServerOverride(server.id);
                  });
                }}
                className="text-xs"
              >
                <Wifi className="h-3 w-3 mr-1" />
                Enable All
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={() => resetServerOverrides()}
                className="text-xs"
              >
                <RotateCcw className="h-3 w-3 mr-1" />
                Reset to Default
              </Button>
            </div>
          </div>
        </div>

        <DropdownMenuSeparator />

        <div className="p-2 text-xs text-muted-foreground">
          <div className="space-y-1">
            <div className="flex items-center gap-1">
              <Wifi className="h-3 w-3 text-green-600" />
              <span>Server is available</span>
            </div>
            <div className="flex items-center gap-1">
              <WifiOff className="h-3 w-3 text-red-600" />
              <span>Server is unavailable</span>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="outline" className="text-xs py-0">
                Override
              </Badge>
              <span>Manual override active</span>
            </div>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
