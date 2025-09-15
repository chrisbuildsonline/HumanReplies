"use client";

import { useState, useEffect, use } from "react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "react-hot-toast";

interface CustomTone {
  id: string;
  name: string;
  display_name: string;
  description?: string;
}

interface UserSettings {
  guardian_text: string;
}

interface StyleAnalysis {
  formality: number;
  warmth: number;
  directness: number;
  signature_phrases: string[];
  banned_terms: string[];
  emoji_usage: string;
  sentence_length: string;
}

export function SettingsContent() {
  // Style analysis states
  const [posts, setPosts] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [styleResult, setStyleResult] = useState<StyleAnalysis | null>(null);
  const [styleError, setStyleError] = useState("");
  const [isSavingStyle, setIsSavingStyle] = useState(false);
  const [hasSavedStyle, setHasSavedStyle] = useState(false);
  const [lastSavedSerialized, setLastSavedSerialized] = useState<string | null>(
    null
  );
  const [hasNewAnalysis, setHasNewAnalysis] = useState(false);

  // Reddit import states
  const [isImportingReddit, setIsImportingReddit] = useState(false);
  const [redditConfigured, setRedditConfigured] = useState<boolean | null>(null);

  // User settings states
  const [guardianText, setGuardianText] = useState("");
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [isLoadingSettings, setIsLoadingSettings] = useState(true);

  // Custom tones states
  const [customTones, setCustomTones] = useState<CustomTone[]>([]);
  const [isLoadingTones, setIsLoadingTones] = useState(true);
  const [newToneDisplayName, setNewToneDisplayName] = useState("");
  const [newToneDescription, setNewToneDescription] = useState("");
  const [editingTone, setEditingTone] = useState<string | null>(null);

  // Tab navigation state
  const [activeTab, setActiveTab] = useState<"reply-tone" | "writing-style">(
    "reply-tone"
  );

  // Load user settings and tones on mount
  useEffect(() => {
    loadUserSettings();
    loadCustomTones();
    loadWritingStyle();
    checkRedditConfig();
  }, []);

  // Handle Reddit OAuth callback
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const redditPosts = urlParams.get("reddit_posts");
    const redditCount = urlParams.get("reddit_count");
    const redditError = urlParams.get("reddit_error");

    if (redditPosts) {
      setPosts(decodeURIComponent(redditPosts));
      toast.success(`Successfully imported ${redditCount} posts from Reddit!`);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    } else if (redditError) {
      let errorMessage = "Failed to import from Reddit";
      switch (redditError) {
        case "no_posts":
          errorMessage = "No text posts found in your Reddit history";
          break;
        case "no_code":
          errorMessage = "Authorization was cancelled";
          break;
        case "auth_failed":
          errorMessage = "Authentication failed. Please try again";
          break;
        default:
          errorMessage = `Reddit import failed: ${redditError}`;
      }
      toast.error(errorMessage);
      // Clean up URL parameters
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  const loadUserSettings = async () => {
    try {
      const response = await fetch("/api/user-settings");
      if (response.ok) {
        const settings: UserSettings = await response.json();
        setGuardianText(settings.guardian_text || "");
      }
    } catch (error) {
      console.error("Failed to load user settings:", error);
      toast.error("Failed to load settings");
    } finally {
      setIsLoadingSettings(false);
    }
  };

  const loadCustomTones = async () => {
    try {
      const response = await fetch("/api/tones");
      if (response.ok) {
        const data = await response.json();
        // Filter to only show custom tones (not preset tones)
        const allTones = data.tones || data;
        const customTonesOnly = Array.isArray(allTones)
          ? allTones.filter((tone) => !tone.is_preset && tone.user_id)
          : [];
        setCustomTones(customTonesOnly);
      }
    } catch (error) {
      console.error("Failed to load custom tones:", error);
      toast.error("Failed to load custom tones");
    } finally {
      setIsLoadingTones(false);
    }
  };

  const loadWritingStyle = async () => {
    try {
      const response = await fetch("/api/writing-style");
      if (response.ok) {
        const data = await response.json();
        if (data.style) {
          setStyleResult(data.style);
          if (data.custom_instructions) {
            setCustomInstructions(data.custom_instructions);
          }
          // Mark that a saved style exists
          const serialized = JSON.stringify({
            style: data.style,
            custom_instructions: data.custom_instructions || null,
          });
          setLastSavedSerialized(serialized);
          setHasSavedStyle(true);
          setHasNewAnalysis(false); // fresh load, no new analysis yet
        }
      }
    } catch (error) {
      console.error("Failed to load writing style:", error);
    }
  };

  const checkRedditConfig = async () => {
    try {
      const response = await fetch("/api/reddit/config");
      if (response.ok) {
        const data = await response.json();
        setRedditConfigured(data.configured || false);
      } else {
        setRedditConfigured(false);
      }
    } catch (error) {
      console.error("Failed to check Reddit config:", error);
      setRedditConfigured(false);
    }
  };

  const saveUserSettings = async () => {
    setIsSavingSettings(true);
    try {
      const response = await fetch("/api/user-settings", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          guardian_text: guardianText,
        }),
      });

      if (response.ok) {
        toast.success("Settings saved successfully!");
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to save settings:", error);
      toast.error("Failed to save settings");
    } finally {
      setIsSavingSettings(false);
    }
  };

  const addCustomTone = async () => {
    if (!newToneDisplayName.trim()) return;

    // Generate a random ID for the tone name
    const randomId = `custom_tone_${Date.now()}_${Math.random()
      .toString(36)
      .substring(2, 11)}`;

    try {
      const response = await fetch("/api/tones", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: randomId,
          display_name: newToneDisplayName,
          description: newToneDescription || null,
        }),
      });

      const responseData = await response.json();

      if (response.ok) {
        const newTone: CustomTone = {
          id: responseData.id,
          name: responseData.name,
          display_name: responseData.display_name,
          description: responseData.description,
        };
        setCustomTones([...customTones, newTone]);
        setNewToneDisplayName("");
        setNewToneDescription("");
        toast.success("Custom tone created successfully!");

        // Reload tones to ensure we have the latest data
        loadCustomTones();
      } else {
        console.error("Backend error:", responseData);
        toast.error(responseData.error || "Failed to create tone");
      }
    } catch (error) {
      console.error("Failed to create tone:", error);
      toast.error("Failed to create tone");
    }
  };

  const updateCustomTone = async (
    toneId: string,
    updates: Partial<CustomTone>
  ) => {
    try {
      const response = await fetch(`/api/tones/${toneId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });

      const responseData = await response.json();

      if (response.ok) {
        const updatedTone: CustomTone = {
          id: responseData.id,
          name: responseData.name,
          display_name: responseData.display_name,
          description: responseData.description,
        };
        setCustomTones(
          customTones.map((tone) => (tone.id === toneId ? updatedTone : tone))
        );
        toast.success("Tone updated successfully!");
      } else {
        console.error("Backend error:", responseData);
        toast.error(responseData.error || "Failed to update tone");
      }
    } catch (error) {
      console.error("Failed to update tone:", error);
      toast.error("Failed to update tone");
    }
  };

  const deleteCustomTone = async (toneId: string) => {
    try {
      const response = await fetch(`/api/tones/${toneId}`, {
        method: "DELETE",
      });

      if (response.ok) {
        setCustomTones(customTones.filter((tone) => tone.id !== toneId));
        toast.success("Tone deleted successfully!");
      } else {
        const responseData = await response.json();
        console.error("Backend error:", responseData);
        toast.error(responseData.error || "Failed to delete tone");
      }
    } catch (error) {
      console.error("Failed to delete tone:", error);
      toast.error("Failed to delete tone");
    }
  };

  const analyzeStyle = async () => {
    // Allow analysis even with just custom instructions
    if (!posts.trim() && !customInstructions.trim()) {
      setStyleError(
        "Please provide either writing samples or custom instructions."
      );
      return;
    }

    setIsAnalyzing(true);
    setStyleError("");
    setStyleResult(null);

    try {
      const response = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: posts.trim() || null,
          customInstructions: customInstructions.trim() || null,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.error === "Insufficient content for analysis") {
          setStyleError(
            `${data.message} (Current: ${data.currentLength} characters, Need: ${data.minimumLength})`
          );
        } else {
          setStyleError(data.error || "Analysis failed. Please try again.");
        }
        return;
      }

      if (data.success && data.style) {
        setStyleResult(data.style);
        // Mark that there's a new analysis compared to last saved
        const newSerialized = JSON.stringify({
          style: data.style,
          custom_instructions: customInstructions.trim() || null,
        });
        if (newSerialized !== lastSavedSerialized) {
          setHasNewAnalysis(true);
        } else {
          setHasNewAnalysis(false);
        }
        toast.success("Style analysis completed successfully!");
      } else {
        setStyleError(
          data.message || "Analysis completed but returned unexpected format."
        );
      }
    } catch (error) {
      console.error("Analysis failed:", error);
      setStyleError("Analysis failed. Please try again.");
      toast.error("Style analysis failed");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const saveWritingStyle = async () => {
    if (!styleResult) {
      toast.error("No writing style to save. Please analyze your style first.");
      return;
    }

    if (!hasNewAnalysis) {
      toast.error(
        "No new analysis to save. Analyze again to update your style."
      );
      return;
    }

    setIsSavingStyle(true);
    try {
      const response = await fetch("/api/writing-style", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          style: styleResult,
          custom_instructions: customInstructions.trim() || null,
        }),
      });

      if (response.ok) {
        toast.success("Writing style saved successfully!");
        const serialized = JSON.stringify({
          style: styleResult,
          custom_instructions: customInstructions.trim() || null,
        });
        setLastSavedSerialized(serialized);
        setHasSavedStyle(true);
        setHasNewAnalysis(false);
      } else {
        throw new Error(`HTTP ${response.status}`);
      }
    } catch (error) {
      console.error("Failed to save writing style:", error);
      toast.error("Failed to save writing style");
    } finally {
      setIsSavingStyle(false);
    }
  };

  const importFromReddit = () => {
    // Launch Reddit OAuth in a centered popup so user stays on page
    // Falls back to full redirect if popup blocked
    if (isImportingReddit) return;
    setIsImportingReddit(true);

    const width = 600;
    const height = 700;
    const left = window.screenX + Math.max(0, (window.outerWidth - width) / 2);
    const top = window.screenY + Math.max(0, (window.outerHeight - height) / 2);
    const features = `popup=yes,toolbar=no,location=no,status=no,menubar=no,scrollbars=yes,resizable=yes,width=${width},height=${height},left=${left},top=${top}`;
    const popup = window.open(
      "/api/reddit/auth?popup=1",
      "reddit_oauth",
      features
    );

    if (!popup) {
      // Popup blocked -> fallback to previous full page redirect
      window.location.href = "/api/reddit/auth";
      return;
    }

    // Listener is attached only once (guard via flag on window)
    if (!(window as any).__redditOAuthListenerInstalled) {
      (window as any).__redditOAuthListenerInstalled = true;
      window.addEventListener("message", (event: MessageEvent) => {
        if (!event.data || event.data.source !== "reddit-oauth") return;
        const payload = event.data.data || {};
        if (payload.status === "success") {
          setPosts(payload.posts || "");
          toast.success(
            `Successfully imported ${
              payload.count || 0
            } posts/comments from Reddit!`
          );
        } else {
          const err = payload.error || "unknown_error";
          toast.error("Reddit import failed: " + err);
        }
        setIsImportingReddit(false);
      });
    }

    // Safety timeout: if nothing returned in 90s, reset state
    setTimeout(() => {
      if (isImportingReddit) {
        setIsImportingReddit(false);
      }
    }, 90000);
  };

  if (isLoadingSettings || isLoadingTones) {
    return (
      <div className="bg-[#f6f1e8] py-12 px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="text-xl text-black">Loading settings...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[#f6f1e8] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">Settings</h1>
          <p className="text-muted-foreground">
            Customize your HumanReplies experience and manage your preferences.
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-8">
          <div className="flex space-x-1 rounded-xl bg-gray-200 p-1 border-2 border-black">
            <button
              onClick={() => setActiveTab("reply-tone")}
              className={`w-full rounded-lg py-2.5 text-sm font-bold leading-5 transition-all duration-200 ${
                activeTab === "reply-tone"
                  ? "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
                  : "text-black/70 hover:bg-white/50"
              }`}
            >
              🎭 Reply Tone
            </button>
            <button
              onClick={() => setActiveTab("writing-style")}
              className={`w-full rounded-lg py-2.5 text-sm font-bold leading-5 transition-all duration-200 ${
                activeTab === "writing-style"
                  ? "bg-white text-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] border-2 border-black"
                  : "text-black/70 hover:bg-white/50"
              }`}
            >
              ✍️ Writing Style
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="space-y-8">
          {/* Reply Tone Tab */}
          {activeTab === "reply-tone" && (
            <Card className="chunky-card border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
              <CardHeader>
                <CardTitle className="text-2xl font-black text-black">
                  🎭 Custom Tones
                </CardTitle>
                <CardDescription className="text-black/70">
                  Create and manage your own custom reply tones
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Create New Tone */}
                <div className="border-t-2 border-gray-200 pt-6">
                  <h3 className="text-lg font-bold text-black mb-4">
                    Create Custom Tone
                  </h3>
                  <div className="grid grid-cols-1 gap-4 mb-4">
                    <div>
                      <Label
                        htmlFor="tone-display-name"
                        className="text-sm font-bold text-black mb-1 block"
                      >
                        Display Name
                      </Label>
                      <Input
                        id="tone-display-name"
                        placeholder="e.g., 🏢 My Professional"
                        value={newToneDisplayName}
                        onChange={(e) => setNewToneDisplayName(e.target.value)}
                        className="border-2 border-black rounded-lg"
                      />
                    </div>
                  </div>
                  <div className="mb-4">
                    <Label
                      htmlFor="tone-description"
                      className="text-sm font-bold text-black mb-1 block"
                    >
                      Description
                    </Label>
                    <Textarea
                      id="tone-description"
                      placeholder="e.g., Don't use any smileys, Keep responses under 50 words, Always be formal, etc..."
                      value={newToneDescription}
                      onChange={(e) => setNewToneDescription(e.target.value)}
                      className="border-2 border-black rounded-lg min-h-[80px]"
                    />
                  </div>
                  <Button
                    onClick={addCustomTone}
                    disabled={!newToneDisplayName.trim()}
                    className="chunky-button bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    Add Custom Tone
                  </Button>
                </div>

                {/* Existing Custom Tones */}
                {customTones.length > 0 && (
                  <div className="border-t-2 border-gray-200 pt-6">
                    <h3 className="text-lg font-bold text-black mb-4">
                      Your Custom Tones
                    </h3>
                    <div className="space-y-3">
                      {customTones.map((tone) => (
                        <div
                          key={tone.id}
                          className="border-2 border-gray-300 rounded-lg p-4 bg-gray-50"
                        >
                          {editingTone === tone.id ? (
                            <div className="space-y-3">
                              <div className="space-y-3">
                                <div>
                                  <Label className="text-xs font-bold text-black mb-1 block">
                                    Display Name
                                  </Label>
                                  <Input
                                    value={tone.display_name}
                                    onChange={(e) =>
                                      setCustomTones(
                                        customTones.map((t) =>
                                          t.id === tone.id
                                            ? {
                                                ...t,
                                                display_name: e.target.value,
                                              }
                                            : t
                                        )
                                      )
                                    }
                                    className="border-2 border-black rounded-lg"
                                    placeholder="Display name"
                                  />
                                </div>
                              </div>
                              <Textarea
                                value={tone.description || ""}
                                onChange={(e) =>
                                  setCustomTones(
                                    customTones.map((t) =>
                                      t.id === tone.id
                                        ? { ...t, description: e.target.value }
                                        : t
                                    )
                                  )
                                }
                                className="border-2 border-black rounded-lg min-h-[60px]"
                                placeholder="Description"
                              />
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => {
                                    updateCustomTone(tone.id, {
                                      display_name: tone.display_name,
                                      description: tone.description,
                                    });
                                    setEditingTone(null);
                                  }}
                                  className="chunky-button bg-blue-500 hover:bg-blue-600 text-white font-bold py-1 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)]"
                                  size="sm"
                                >
                                  Save
                                </Button>
                                <Button
                                  onClick={() => setEditingTone(null)}
                                  variant="outline"
                                  className="border-2 border-black"
                                  size="sm"
                                >
                                  Cancel
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex justify-between items-start">
                              <div>
                                <h4 className="font-bold text-black">
                                  {tone.display_name}
                                </h4>

                                {tone.description && (
                                  <p className="text-sm text-black/60">
                                    {tone.description}
                                  </p>
                                )}
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  onClick={() => setEditingTone(tone.id)}
                                  variant="outline"
                                  className="border-2 border-black"
                                  size="sm"
                                >
                                  Edit
                                </Button>
                                <Button
                                  onClick={() => deleteCustomTone(tone.id)}
                                  variant="outline"
                                  className="border-2 border-red-500 text-red-500 hover:bg-red-50"
                                  size="sm"
                                >
                                  Delete
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Writing Style Tab */}
          {activeTab === "writing-style" && (
            <>
              {/* Your Style Summary Section */}
              <Card className="chunky-card border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-black">
                    📝 Your Writing Style
                  </CardTitle>
                  <CardDescription className="text-black/70">
                    Train the AI to write in your personal style by analyzing
                    your posts/texts.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Text Input Method */}
                  <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50 mb-6">
                    <Label
                      htmlFor="posts-input"
                      className="text-sm font-bold text-black mb-2 block"
                    >
                      Paste Your Writing Samples
                    </Label>
                    <Textarea
                      id="posts-input"
                      placeholder="Paste your posts, messages, or any text that represents your writing style. Separate different posts with double line breaks (press Enter twice)..."
                      value={posts}
                      onChange={(e) => setPosts(e.target.value)}
                      className="border-2 border-black rounded-lg min-h-[200px] text-sm"
                    />
                    <div className="flex justify-between items-center mt-2">
                      <span className="text-xs text-black/60">
                        Characters: {posts.length} (minimum 500 recommended)
                      </span>
                    </div>
                  </div>

                  {/* Custom Instructions */}
                  <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                    <Label
                      htmlFor="custom-instructions"
                      className="text-sm font-bold text-black mb-2 block"
                    >
                      Custom Instructions (Optional)
                    </Label>
                    <Textarea
                      id="custom-instructions"
                      placeholder="e.g., Don't use any smileys, Keep responses under 50 words, Always be formal, etc..."
                      value={customInstructions}
                      onChange={(e) => setCustomInstructions(e.target.value)}
                      className="border-2 border-black rounded-lg min-h-[100px] text-sm"
                    />
                    <p className="text-xs text-black/60 mt-1">
                      Additional manual instructions that will be passed as
                      prompts to customize the AI's responses
                    </p>
                  </div>

                  <div className="flex gap-3 flex-wrap">
                    <Button
                      onClick={analyzeStyle}
                      disabled={
                        isAnalyzing ||
                        (!posts.trim() && !customInstructions.trim())
                      }
                      className="chunky-button bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                    >
                      {isAnalyzing ? "Analyzing..." : "Analyze Style"}
                    </Button>

                    {redditConfigured && (
                      <Button
                        onClick={importFromReddit}
                        disabled={isImportingReddit}
                        className="chunky-button bg-orange-500 hover:bg-orange-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                      >
                        {isImportingReddit
                          ? "Importing..."
                          : "Import comments from Reddit"}
                      </Button>
                    )}
                  </div>

                  {/* Style Analysis Results */}
                  <div className="border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                    <div className="flex justify-between items-center mb-4">
                      <h4 className="font-bold text-black">
                        {styleResult
                          ? "Current Writing Style"
                          : "Style Analysis Results"}
                      </h4>
                      {styleResult && (
                        <Button
                          onClick={saveWritingStyle}
                          disabled={isSavingStyle || !hasNewAnalysis}
                          className="chunky-button bg-green-500 hover:bg-green-600 text-white font-bold py-1 px-3 rounded border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] disabled:opacity-50 disabled:cursor-not-allowed"
                          size="sm"
                        >
                          {isSavingStyle
                            ? hasSavedStyle
                              ? "Updating..."
                              : "Saving..."
                            : hasSavedStyle
                            ? "Update Writing Style"
                            : "Save Writing Style"}
                        </Button>
                      )}
                    </div>
                    {styleError && (
                      <div className="p-3 border-2 border-red-300 rounded-lg bg-red-50 text-red-700 text-sm mb-3">
                        {styleError}
                      </div>
                    )}
                    {styleResult ? (
                      <div className="space-y-4">
                        <div className="p-4 border-2 border-green-300 rounded-lg bg-green-50">
                          <h5 className="font-bold text-green-800 mb-4">
                            Your Writing Style Profile:
                          </h5>

                          {/* Progress bars for numeric attributes */}
                          <div className="space-y-4 mb-4">
                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-semibold text-gray-700">
                                  Formality
                                </span>
                                <span className="text-sm font-bold text-green-700">
                                  {(styleResult.formality * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 border border-gray-300">
                                <div
                                  className="bg-gradient-to-r from-green-400 to-green-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${styleResult.formality * 100}%`,
                                  }}
                                ></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-semibold text-gray-700">
                                  Warmth
                                </span>
                                <span className="text-sm font-bold text-blue-700">
                                  {(styleResult.warmth * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 border border-gray-300">
                                <div
                                  className="bg-gradient-to-r from-blue-400 to-blue-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${styleResult.warmth * 100}%`,
                                  }}
                                ></div>
                              </div>
                            </div>

                            <div>
                              <div className="flex justify-between items-center mb-1">
                                <span className="text-sm font-semibold text-gray-700">
                                  Directness
                                </span>
                                <span className="text-sm font-bold text-purple-700">
                                  {(styleResult.directness * 100).toFixed(0)}%
                                </span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2 border border-gray-300">
                                <div
                                  className="bg-gradient-to-r from-purple-400 to-purple-600 h-2 rounded-full transition-all duration-300"
                                  style={{
                                    width: `${styleResult.directness * 100}%`,
                                  }}
                                ></div>
                              </div>
                            </div>
                          </div>

                          {/* Other attributes in a grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm border-t pt-3">
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <strong className="text-gray-700">
                                Emoji Usage:
                              </strong>
                              <span className="text-gray-900 capitalize">
                                {styleResult.emoji_usage}
                              </span>
                            </div>
                            <div className="flex items-center justify-between p-2 bg-white rounded border">
                              <strong className="text-gray-700">
                                Sentence Length:
                              </strong>
                              <span className="text-gray-900 capitalize">
                                {styleResult.sentence_length}
                              </span>
                            </div>
                          </div>

                          {/* Signature phrases and banned terms */}
                          {(styleResult.signature_phrases?.length > 0 ||
                            styleResult.banned_terms?.length > 0) && (
                            <div className="mt-4 space-y-3 border-t pt-3">
                              {styleResult.signature_phrases &&
                                styleResult.signature_phrases.length > 0 && (
                                  <div>
                                    <strong className="text-gray-700 text-sm block mb-1">
                                      Signature Phrases:
                                    </strong>
                                    <div className="flex flex-wrap gap-1">
                                      {styleResult.signature_phrases.map(
                                        (phrase, index) => (
                                          <span
                                            key={index}
                                            className="inline-block bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full border border-green-300"
                                          >
                                            "{phrase}"
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                              {styleResult.banned_terms &&
                                styleResult.banned_terms.length > 0 && (
                                  <div>
                                    <strong className="text-gray-700 text-sm block mb-1">
                                      Terms to Avoid:
                                    </strong>
                                    <div className="flex flex-wrap gap-1">
                                      {styleResult.banned_terms.map(
                                        (term, index) => (
                                          <span
                                            key={index}
                                            className="inline-block bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full border border-red-300"
                                          >
                                            "{term}"
                                          </span>
                                        )
                                      )}
                                    </div>
                                  </div>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="p-3 border-2 border-gray-300 rounded-lg bg-white text-gray-600 text-sm">
                        Your style analysis will appear here after you provide
                        text samples or custom instructions and click "Analyze
                        Style".
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Guardian Settings */}
              <Card className="chunky-card border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                <CardHeader>
                  <CardTitle className="text-2xl font-black text-black">
                    🛡️ Guardian Instructions
                  </CardTitle>
                  <CardDescription className="text-black/70">
                    Set guidelines for what the AI should avoid in replies
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <Label
                      htmlFor="guardian-text"
                      className="text-sm font-bold text-black mb-1 block"
                    >
                      Guardian Instructions (What NOT to include)
                    </Label>
                    <Textarea
                      id="guardian-text"
                      placeholder="e.g., Never use inappropriate language, avoid controversial topics, don't make promises I can't keep..."
                      value={guardianText}
                      onChange={(e) => setGuardianText(e.target.value)}
                      className="border-2 border-black rounded-lg min-h-[100px]"
                    />
                  </div>

                  <Button
                    onClick={saveUserSettings}
                    disabled={isSavingSettings}
                    className="chunky-button bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {isSavingSettings ? "Saving..." : "Save Settings"}
                  </Button>
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
