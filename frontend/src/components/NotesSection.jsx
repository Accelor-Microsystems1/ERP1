import React, { useState } from "react";
import { Input, Button } from "antd";
import { DateTime } from "luxon";
import {
  PlusIcon,
  CheckIcon,
  XMarkIcon,
  PencilIcon,
  TrashIcon,
} from "@heroicons/react/24/outline";

const NotesSection = ({
  fetchedNotes,
  currentUserNotes,
  setCurrentUserNotes,
  currentUser,
  readOnly = false,
  highlightNote = false,
  setHighlightNote = () => {},
}) => {
  const [newNote, setNewNote] = useState("");
  const [showNoteInput, setShowNoteInput] = useState(false);
  const [editingNoteIndex, setEditingNoteIndex] = useState(null);
  const [editingNoteContent, setEditingNoteContent] = useState("");

  // Combine fetchedNotes and currentUserNotes for display
  const allNotes = [...fetchedNotes, ...currentUserNotes];

  const handleAddNote = () => {
    if (!newNote.trim()) return;

    const noteToAdd = {
      timestamp: new Date().toISOString(),
      user_name: currentUser,
      content: newNote.trim(),
    };

    setCurrentUserNotes([...currentUserNotes, noteToAdd]);
    setNewNote("");
    setShowNoteInput(false);
    setHighlightNote(false);
  };

  const handleEditNote = (index) => {
    // Only allow editing of notes in currentUserNotes
    if (index < fetchedNotes.length) {
      alert("You cannot edit notes added by other users.");
      return;
    }
    setEditingNoteIndex(index);
    setEditingNoteContent(allNotes[index].content);
  };

  const handleSaveEditNote = (index) => {
    if (!editingNoteContent.trim()) return;

    // Adjust index to map to currentUserNotes
    const adjustedIndex = index - fetchedNotes.length;
    const updatedNote = {
      ...currentUserNotes[adjustedIndex],
      content: editingNoteContent.trim(),
      timestamp: new Date().toISOString(),
    };

    const updatedNotes = [...currentUserNotes];
    updatedNotes[adjustedIndex] = updatedNote;
    setCurrentUserNotes(updatedNotes);
    setEditingNoteIndex(null);
    setEditingNoteContent("");
  };

  const handleCancelEditNote = () => {
    setEditingNoteIndex(null);
    setEditingNoteContent("");
  };

  const handleDeleteNote = (index) => {
    // Only allow deletion of notes in currentUserNotes
    if (index < fetchedNotes.length) {
      alert("You can only delete notes that you have created.");
      return;
    }
    const adjustedIndex = index - fetchedNotes.length;
    setCurrentUserNotes((prevNotes) => prevNotes.filter((_, i) => i !== adjustedIndex));
  };

  return (
    <div className="mt-6">
      <h3 className="text-xl font-semibold text-gray-900 mb-4">Notes</h3>
      {allNotes.length === 0 ? (
        <p className="text-gray-500 italic">No notes added yet.</p>
      ) : (
        <div className="space-y-4">
          {allNotes.map((note, index) => {
            const displayUserName = note.user_name || note.userName || note.username || "Unknown";
            const isCurrentUserNote = index >= fetchedNotes.length; // Notes in currentUserNotes
            return (
              <div
                key={index}
                className="p-4 bg-gray-50 rounded-lg shadow-sm border border-gray-200 relative"
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center space-x-2">
                    <span className="font-medium text-gray-800">
                      {displayUserName}
                    </span>
                    <span className="text-sm text-gray-500">
                      {DateTime.fromISO(note.timestamp).toFormat("dd-MM-yy HH:mm:ss")}
                    </span>
                  </div>
                  {!readOnly && isCurrentUserNote && displayUserName === currentUser && (
                    <div className="flex space-x-2">
                      <button
                        onClick={() => handleEditNote(index)}
                        className="text-blue-500 hover:text-blue-800"
                      >
                        <PencilIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleDeleteNote(index)}
                        className="text-red-500 hover:text-red-800"
                      >
                        <TrashIcon className="h-5 w-5" />
                      </button>
                    </div>
                  )}
                </div>
                {editingNoteIndex === index ? (
                  <div className="relative">
                    <Input.TextArea
                      value={editingNoteContent}
                      onChange={(e) => setEditingNoteContent(e.target.value)}
                      autoSize={{ minRows: 2 }}
                      className="w-full rounded-lg pr-20"
                    />
                    <div className="absolute right-2 bottom-2 flex space-x-2">
                      <button
                        onClick={handleCancelEditNote}
                        className="text-gray-600 hover:text-gray-800"
                      >
                        <XMarkIcon className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => handleSaveEditNote(index)}
                        className="text-blue-600 hover:text-blue-800"
                        disabled={!editingNoteContent.trim()}
                      >
                        <CheckIcon className="h-5 w-5" />
                      </button>
                    </div>
                  </div>
                ) : (
                  <p className="text-gray-700">{note.content}</p>
                )}
              </div>
            );
          })}
        </div>
      )}
      {!readOnly && (
        <div className="mt-4">
          {showNoteInput ? (
            <div className="relative">
              <Input.TextArea
                placeholder="Add your note here..."
                value={newNote}
                onChange={(e) => {
                  setNewNote(e.target.value);
                  if (e.target.value.trim()) {
                    setHighlightNote(false);
                  }
                }}
                autoSize={{ minRows: 2 }}
                className="w-full rounded-lg pr-20"
                style={
                  highlightNote
                    ? {
                        borderColor: "#f5222d",
                        boxShadow: "none",
                      }
                    : {}
                }
              />
              {highlightNote && (
                <span className="text-red-500 text-xs mt-1 block">Required*</span>
              )}
              <div className="absolute right-2 bottom-2 flex space-x-2">
                <button
                  onClick={() => {
                    setShowNoteInput(false);
                    setNewNote("");
                    setHighlightNote(false);
                  }}
                  className="text-gray-600 hover:text-gray-800"
                >
                  <XMarkIcon className="h-5 w-5" />
                </button>
                <button
                  onClick={handleAddNote}
                  className="text-blue-600 hover:text-blue-800"
                  disabled={!newNote.trim()}
                >
                  <CheckIcon className="h-5 w-5" />
                </button>
              </div>
            </div>
          ) : (
            <Button
              onClick={() => {
                setShowNoteInput(true);
                setHighlightNote(false);
              }}
              className="flex items-center space-x-2 text-blue-600 hover:text-blue-800"
            >
              <PlusIcon className="h-5 w-5" />
              <span>Add a Line</span>
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

export default NotesSection;