// RouteWaypointList — Wegpunkt-Liste mit Drag-to-Reorder, Löschen, Route berechnen/speichern/laden.
// v0.9020: "Route löschen" Button mit Bestätigungs-Dialog.

import React, { useState } from "react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { GripVertical, Trash2, Calculator, Save, FolderOpen, Loader2, X } from "lucide-react";

export default function RouteWaypointList({
  waypoints,
  onReorder,
  onDelete,
  onClearAll = () => { console.warn("onClearAll not provided"); },
  onCalculate,
  calculating,
  onSaveRoute,
  onLoadRoute,
  savedRoutes,
  loadingRoutes,
}) {
  const [showSaved, setShowSaved] = useState(false);
  const [routeName, setRouteName] = useState("");
  const [showConfirmClear, setShowConfirmClear] = useState(false);

  const handleDragEnd = (result) => {
    if (!result.destination) return;
    onReorder(result.source.index, result.destination.index);
  };

  const handleSave = () => {
    if (!routeName.trim()) return;
    onSaveRoute(routeName.trim());
    setRouteName("");
  };

  const handleClearAll = () => {
    if (typeof onClearAll === 'function') {
      onClearAll();
    } else {
      // Fallback: Alle Wegpunkte in umgekehrter Reihenfolge löschen (Indizes verschieben sich nicht)
      for (let i = waypoints.length - 1; i >= 0; i--) {
        onDelete(i);
      }
    }
    setShowConfirmClear(false);
  };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-xl border border-gray-200 dark:border-slate-700 p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-gray-500 dark:text-slate-400">
          Wegpunkte ({waypoints.length})
        </span>
        <div className="flex items-center gap-3">
          {waypoints.length > 0 && (
            <button
              onClick={() => setShowConfirmClear(true)}
              className="flex items-center gap-1 text-xs text-red-600 dark:text-red-400 hover:underline"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Route löschen
            </button>
          )}
          <button
            onClick={() => setShowSaved(!showSaved)}
            className="flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            Meine Routen
          </button>
        </div>
      </div>

      {/* Gespeicherte Routen Dropdown */}
      {showSaved && (
        <div className="bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2 space-y-1 max-h-40 overflow-y-auto">
          {loadingRoutes ? (
            <div className="flex justify-center py-2">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : savedRoutes.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-2">Keine gespeicherten Routen</p>
          ) : (
            savedRoutes.map((route) => (
              <div key={route.id} className="flex items-center gap-2 py-1">
                <button
                  onClick={() => {
                    onLoadRoute(route);
                    setShowSaved(false);
                  }}
                  className="flex-1 text-left text-xs font-medium text-gray-700 dark:text-slate-200 hover:text-blue-600 dark:hover:text-blue-400 truncate"
                >
                  {route.name} ({route.waypoints?.length || 0} WP, {route.total_distance_km || 0} km)
                </button>
              </div>
            ))
          )}
        </div>
      )}

      {/* Wegpunkt-Liste mit Drag-and-Drop */}
      {waypoints.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">
          Keine Wegpunkte — suchen Sie oben nach Orten oder importieren Sie GPX/Google Maps
        </p>
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <Droppable droppableId="waypoints">
            {(provided) => (
              <div {...provided.droppableProps} ref={provided.innerRef} className="space-y-1 max-h-48 overflow-y-auto">
                {waypoints.map((wp, index) => (
                  <Draggable key={index} draggableId={`wp-${index}`} index={index}>
                    {(prov) => (
                      <div
                        ref={prov.innerRef}
                        {...prov.draggableProps}
                        {...prov.dragHandleProps}
                        className="flex items-center gap-2 bg-gray-50 dark:bg-slate-700/50 rounded-lg p-2"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="w-5 h-5 flex items-center justify-center bg-blue-600 text-white text-[10px] font-bold rounded-full flex-shrink-0">
                          {index + 1}
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-900 dark:text-slate-100 truncate">
                            {wp.name || `${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)}`}
                          </p>
                          <p className="text-[10px] text-gray-400">
                            {wp.lat.toFixed(4)}, {wp.lon.toFixed(4)}
                          </p>
                        </div>
                        <button
                          onClick={() => onDelete(index)}
                          className="p-1 text-gray-400 hover:text-red-500"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    )}
                  </Draggable>
                ))}
                {provided.placeholder}
              </div>
            )}
          </Droppable>
        </DragDropContext>
      )}

      {/* Aktions-Buttons */}
      {waypoints.length >= 2 && (
        <div className="space-y-2 pt-1">
          <button
            onClick={onCalculate}
            disabled={calculating}
            className="w-full flex items-center justify-center gap-1.5 px-3 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50"
          >
            {calculating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calculator className="w-4 h-4" />}
            Route berechnen
          </button>

          <div className="flex items-center gap-1">
            <input
              type="text"
              value={routeName}
              onChange={(e) => setRouteName(e.target.value)}
              placeholder="Routen-Name"
              className="flex-1 px-2.5 py-1.5 text-xs bg-white dark:bg-slate-700 border border-gray-200 dark:border-slate-600 rounded-lg text-gray-900 dark:text-slate-100 placeholder-gray-400 outline-none focus:ring-2 focus:ring-blue-300"
            />
            <button
              onClick={handleSave}
              disabled={!routeName.trim()}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-green-600 border border-green-200 rounded-lg hover:bg-green-50 disabled:opacity-50"
            >
              <Save className="w-3.5 h-3.5" />
              Speichern
            </button>
          </div>
        </div>
      )}

      {/* Bestätigungs-Dialog: Alle Punkte löschen */}
      {showConfirmClear && (
        <div className="fixed inset-0 z-[10001] bg-black/50 flex items-center justify-center p-4" onClick={() => setShowConfirmClear(false)}>
          <div className="bg-white dark:bg-slate-800 rounded-2xl shadow-2xl w-full max-w-sm p-6" onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Trash2 className="w-6 h-6 text-red-500" />
            </div>
            <h3 className="text-lg font-bold text-center text-gray-900 dark:text-slate-100">Route löschen?</h3>
            <p className="text-sm text-gray-500 dark:text-slate-400 text-center mt-2">
              Alle {waypoints.length} Wegpunkte, die Route und die Repeater-Liste werden entfernt. Andere Karten-Layer bleiben unverändert.
            </p>
            <div className="flex gap-2 mt-6">
              <button onClick={() => setShowConfirmClear(false)} className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 dark:text-slate-300 border border-gray-200 dark:border-slate-700 rounded-lg hover:bg-gray-50 dark:hover:bg-slate-700">
                Abbrechen
              </button>
              <button onClick={handleClearAll} className="flex-1 px-4 py-2.5 text-sm font-medium text-white bg-red-500 rounded-lg hover:bg-red-600">
                Alle löschen
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}