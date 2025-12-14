/* eslint-disable no-trailing-spaces */
/* eslint-disable no-unused-vars */
/* eslint-disable prefer-const */
/* eslint-disable max-len */
/* eslint-disable require-jsdoc */
import React, {useState, useEffect, useRef } from "react";
import "./Information.css";

export default function Information({data, destinationStop, isAdmin = false, onAddStop, onRemoveStop, onReorderSave, apiUrl, token}) {
  
  const autoScrollDirectionRef = useRef(0);
  const [localStops, setLocalStops] = useState([]);
  const [draggedIndex, setDraggedIndex] = useState(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [touchStart, setTouchStart] = useState(null);
  const [isHoldActive, setIsHoldActive] = useState(false);
  const touchHoldTimeout = React.useRef(null);
  const informationRef = useRef(null);
  const autoScrollIntervalRef = useRef(null);
  const DRAG_THRESHOLD = 10;
  const HOLD_TIME = 1000; // 1 second
  const AUTO_SCROLL_EDGE_DISTANCE = 80;
  const AUTO_SCROLL_SPEED = 12;

  useEffect(() => {
    const el = informationRef.current;
    if (!el) return;

    const handler = (e) => {
      if (isDragging) e.preventDefault();
    };

    el.addEventListener("touchmove", handler, { passive: false });

    return () => {
      el.removeEventListener("touchmove", handler);
    };
  }, [isDragging]);
  
  const handleTouchStart = (index, e) => {
    // Only start drag if touching the hamburger handle
    const isDraggingHandle = e.target?.closest?.('[data-drag-handle]');
    if (!isDraggingHandle) return;

    
    const touch = e.touches?.[0];
    setTouchStart(touch ? {x: touch.clientX, y: touch.clientY, index} : null);
    setDraggedIndex(null);
    setIsDragging(false);
    setIsHoldActive(false);
    
    // Set a timeout for 3 seconds to enable drag
    touchHoldTimeout.current = setTimeout(() => {
      setIsHoldActive(true);
      // Provide visual feedback that hold is complete
      try { document.body.style.overflow = "hidden"; } catch (_) {}
    }, HOLD_TIME);
  };
  
  const handleTouchEnd = () => {
    // Clear the hold timeout if user releases before 3 seconds
    if (touchHoldTimeout.current) {
      clearTimeout(touchHoldTimeout.current);
      touchHoldTimeout.current = null;
    }
    // Stop auto-scroll
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    autoScrollDirectionRef.current = 0;
    setDraggedIndex(null);
    setIsDragging(false);
    setTouchStart(null);
    setIsHoldActive(false);
    try { 
      document.body.style.overflow = "";
    } catch (_) {}
  };

  useEffect(() => {
    setLocalStops(data || []);
    setHasChanges(false);
  }, [data]);

  if (!data || data.length === 0) return <div>No stops data</div>;

  const workingData = isAdmin ? localStops : data;

  // Separate stops into arrived and future
  const arrivedStops = workingData.filter((s) => !!s.arrivalTime);
  const futureStops = workingData.filter((s) => !s.arrivalTime);

  // Determine destination stop
  const destStopId = destinationStop?.id ?? destinationStop;

  // Find the destination stop object
  const destStop = workingData.find((s) => s.id === destStopId);

  // Build display order
  let displayStops = [...arrivedStops];

  // Insert current (en-route) stop immediately after last arrived
  if (destStop && !destStop.arrivalTime) {
    displayStops.push(destStop);
  }

  // Append remaining future stops (exclude the current stop if already pushed)
  futureStops.forEach((s) => {
    if (s.id !== destStopId) displayStops.push(s);
  });

  const getStopDisplayName = (stop) => {
    // 1) Prefer explicit name-like fields
    const explicit = stop?.name || stop?.stop_name || stop?.stopName || stop?.title || stop?.Name || stop?.label;
    if (explicit && String(explicit).trim().length > 0) return String(explicit).trim();

    // 2) Derive from families (can be JSON string, object, or array)
    const familiesRaw = stop?.families;
    if (familiesRaw) {
      try {
        let fam = familiesRaw;
        if (typeof fam === "string") {
          // Try to parse JSON string like '{"100":"Rev. Sam ..."}'
          fam = JSON.parse(fam);
        }
        if (Array.isArray(fam)) {
          if (fam.length > 0) return fam.join(", ");
        } else if (fam && typeof fam === "object") {
          const vals = Object.values(fam).filter(Boolean).map(String);
          if (vals.length > 0) return vals.join(", ");
        } else if (typeof familiesRaw === "string") {
          // Fallback to raw string if not JSON but still helpful
          const trimmed = familiesRaw.trim();
          if (trimmed) return trimmed;
        }
      } catch (_) {
        // If JSON.parse fails, fallback to using raw string
        if (typeof familiesRaw === "string" && familiesRaw.trim()) return familiesRaw.trim();
      }
    }

    // 3) Fallback to first line of address
    const addr = stop?.address || stop?.Address;
    if (addr && typeof addr === "string") {
      const first = addr.split(",")[0].trim();
      return first || addr;
    }

    return "N/A";
  };

  const handleDragStart = (e, index) => {
    setDraggedIndex(index);
    setIsDragging(true);
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Check for auto-scroll near edges during desktop drag
    checkAndAutoScroll(e.clientY);
  };

  const handleDrop = (e, dropIndex) => {
    e.preventDefault();
    if (draggedIndex === null || draggedIndex === dropIndex) return;

    const reordered = [...localStops];
    const [draggedItem] = reordered.splice(draggedIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setLocalStops(reordered);
    setHasChanges(true);
    setDraggedIndex(null);
    setIsDragging(false);
  };

  const handleDragEnd = () => {
    setDraggedIndex(null);
    setIsDragging(false);
    // Stop auto-scroll
    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
      autoScrollIntervalRef.current = null;
    }
    autoScrollDirectionRef.current = 0;
  };

  const performAutoScroll = (direction) => {
    if (autoScrollDirectionRef.current === direction) return;

    autoScrollDirectionRef.current = direction;

    if (autoScrollIntervalRef.current) {
      clearInterval(autoScrollIntervalRef.current);
    }

    autoScrollIntervalRef.current = setInterval(() => {
      // Scroll the information container directly
      const container = informationRef.current;
      if (container) {
        container.scrollTop += direction * AUTO_SCROLL_SPEED;
      }
    }, 16); // ~60fps
  };


  const checkAndAutoScroll = (clientY) => {
    const container = informationRef.current;
    if (!container) return;
    
    const containerRect = container.getBoundingClientRect();
    const containerTop = containerRect.top;
    const containerBottom = containerRect.bottom;

    // Check if there's more content to scroll within the container
    const canScrollDown = container.scrollTop + container.clientHeight < container.scrollHeight;
    const canScrollUp = container.scrollTop > 0;

    // Trigger scroll when drag is near top or bottom edge of container
    const nearTop = clientY < containerTop + AUTO_SCROLL_EDGE_DISTANCE;
    const nearBottom = clientY > containerBottom - AUTO_SCROLL_EDGE_DISTANCE;

    if (nearBottom && canScrollDown) {
      performAutoScroll(1); // scroll down
    } else if (nearTop && canScrollUp) {
      performAutoScroll(-1); // scroll up
    } else {
      autoScrollDirectionRef.current = 0;
      if (autoScrollIntervalRef.current) {
        clearInterval(autoScrollIntervalRef.current);
        autoScrollIntervalRef.current = null;
      }
    }
  };



  const handleTouchMove = (e) => {
    // Only allow drag if user has held for 3+ seconds
    if (!isHoldActive) {
      e.preventDefault();
      return;
    }

    const touch = e.touches[0];
    if (!touch) return;

    // Check for auto-scroll near edges
    checkAndAutoScroll(touch.clientY);

    if (!isDragging) {
      if (!touchStart || touchStart.x == null || touchStart.y == null) return;
      const dx = Math.abs(touch.clientX - touchStart.x);
      const dy = Math.abs(touch.clientY - touchStart.y);
      if (Math.max(dx, dy) < DRAG_THRESHOLD) return;
      setIsDragging(true);
      setDraggedIndex(touchStart.index);
      // Don't set position: fixed, let auto-scroll handle scrolling
      return; // Exit early to let next move do the reorder
    }

    // Find the element under the touch point
    const el = document.elementFromPoint(touch.clientX, touch.clientY);
    if (!el) return;
    
    const targetCard = el.closest?.('[data-stop-index]');
    if (!targetCard) return;
    
    const dropIndex = Number(targetCard.getAttribute("data-stop-index"));
    const activeIndex = draggedIndex ?? touchStart?.index ?? null;
    if (Number.isNaN(dropIndex) || activeIndex == null || dropIndex === activeIndex) return;

    const reordered = [...localStops];
    const [draggedItem] = reordered.splice(activeIndex, 1);
    reordered.splice(dropIndex, 0, draggedItem);

    setDraggedIndex(dropIndex);
    setLocalStops(reordered);
    setHasChanges(true);
  };

  const handleSaveOrder = async () => {
    if (!hasChanges || !apiUrl || !token) return;

    setIsSaving(true);
    try {
      const orderedIds = localStops.map(s => s.id);
      // console.log('Saving order:', orderedIds);
      const response = await fetch(`${apiUrl}/api/admin/${token}/reorder-stops`, {
        method: "POST",
        headers: {"Content-Type": "application/json"},
        body: JSON.stringify({orderedIds}),
      });

      const data = await response.json();
      // console.log('Server response:', data);

      if (!response.ok) {
        throw new Error(data.error || "Failed to save order");
      }

      setHasChanges(false);
      if (onReorderSave) {
        onReorderSave(localStops);
      }
    } catch (err) {
      console.error("Error saving order:", err);
      alert(`Failed to save order: ${err.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const preventTouchScrollWhileDragging = (e) => {
    if (isDragging) {
      e.preventDefault();
    }
  };

  return (
    <div
      ref={informationRef}
      className={`information ${isDragging ? "dragging" : ""}`}
      onTouchMove={(e) => { preventTouchScrollWhileDragging(e); handleTouchMove(e); }}
    >

      {isAdmin && (
        <div className="admin-badge">
          <div className="info-admin">
            <button className="admin-button add-button" onClick={onAddStop}>Add Stop</button>
            <button className="admin-button remove-button" onClick={onRemoveStop}>Remove Stop</button>
            {hasChanges && (
              <button 
                className="admin-button save-button" 
                onClick={handleSaveOrder}
                disabled={isSaving}
              >
                {isSaving ? "Saving..." : "Save Order"}
              </button>
            )}
          </div>
        </div>
      )}

      {isAdmin && displayStops.map((item, index) => {
        const isArrived = !!item.arrivalTime; // green
        const isCurrent = !item.arrivalTime && item.id === destStopId; // orange
        const isDragged = draggedIndex === index;

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            data-stop-index={index}
            className={`info-item ${isArrived ? "arrived-card" : ""} ${isCurrent ? "enroute-card" : ""} draggable-stop ${isDragged ? "dragged-card" : ""}`}
            style={{cursor: "move"}}
          >
            <div className="info-left">
              <div
                className={`check-circle ${
                  isArrived ? "arrived-circle" : isCurrent ? "enroute-circle" : "number-circle"
                }`}
              >
                {isArrived ? "✓" : "x"}
              </div>
              {!isArrived && (
                <div
                  className="drag-handle"
                  data-drag-handle
                  onTouchStart={(e) => {
                    e.stopPropagation();
                    handleTouchStart(index, e);
                  }}
                  onTouchMove={(e) => {
                    e.stopPropagation();
                    handleTouchMove(e);
                  }}
                  onTouchEnd={(e) => {
                    e.stopPropagation();
                    handleTouchEnd();
                  }}
                  onTouchCancel={(e) => {
                    e.stopPropagation();
                    handleTouchEnd();
                  }}
                >
                  ☰
                </div>
              )}
            </div>

            <div className="info-body">
              <p className="info-title">
                {isAdmin ? `Stop ${item.id} • ${getStopDisplayName(item)}` : `Stop ${item.id}`}
              </p>
              <p className="info-line">
                📍{" "}
                <a
                  className="stop-address"
                  href={item.address ? `https://www.google.com/maps/?q=${encodeURIComponent(item.address)}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.address || "N/A"}
                </a>
              </p>

              {index === 0 && item.starting_time && <p className="info-line">Starting Time: {item.starting_time}</p>}

              { item.arrivalTime && (
                <p className="info-line">
                🕒 Arrival Time: {item.arrivalTime ? new Date(item.arrivalTime).toLocaleTimeString() : "N/A"}
                </p>
              )}
            </div>
          </div>
        );
      })}

      {isAdmin === false && displayStops.map((item, index) => {
        const isArrived = !!item.arrivalTime; // green
        const isCurrent = !item.arrivalTime && item.id === destStopId; // orange

        return (
          <div
            key={item.id}
            draggable
            onDragStart={(e) => handleDragStart(e, index)}
            onDragOver={handleDragOver}
            onDrop={(e) => handleDrop(e, index)}
            onDragEnd={handleDragEnd}
            onTouchStart={(e) => handleTouchStart(index, e)}
            onTouchEnd={handleTouchEnd}
            onTouchCancel={handleTouchEnd}
            onTouchMove={handleTouchMove}
            data-stop-index={index}
            className={`info-item ${isArrived ? "arrived-card" : ""} ${isCurrent ? "enroute-card" : ""} ${isAdmin ? "draggable" : ""}`}
            style={{cursor: isAdmin ? "move" : "default"}}
          >
            <div className="info-left">
              <div
                className={`check-circle ${
                  isArrived ? "arrived-circle" : isCurrent ? "enroute-circle" : "number-circle"
                }`}
              >
                {isArrived ? "✓" : "x"}
              </div>
            </div>

            <div className="info-body">
              <p className="info-title">
                {isAdmin ? `Stop ${item.id} • ${getStopDisplayName(item)}` : `Stop ${item.id}`}
              </p>
              <p className="info-line">
                📍{" "}
                <a
                  className="stop-address"
                  href={item.address ? `https://www.google.com/maps/?q=${encodeURIComponent(item.address)}` : "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {item.address || "N/A"}
                </a>
              </p>

              {index === 0 && item.starting_time && <p className="info-line">Starting Time: {item.starting_time}</p>}

              { item.arrivalTime && (
                <p className="info-line">
                🕒 Arrival Time: {item.arrivalTime ? new Date(item.arrivalTime).toLocaleTimeString() : "N/A"}
                </p>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
