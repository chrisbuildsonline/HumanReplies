"use client";

import { useState } from "react";
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

interface CustomTone {
  id: string;
  title: string;
  emoji: string;
  instructions: string;
}

export function SettingsContent() {
  const [posts, setPosts] = useState("");
  const [redditUsername, setRedditUsername] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [styleResult, setStyleResult] = useState("");
  const [customTones, setCustomTones] = useState<CustomTone[]>([]);
  const [selectedTone, setSelectedTone] = useState("ask");
  const [newToneTitle, setNewToneTitle] = useState("");
  const [newToneEmoji, setNewToneEmoji] = useState("");
  const [newToneInstructions, setNewToneInstructions] = useState("");
  const [editingTone, setEditingTone] = useState<string | null>(null);
  const [trainingMethod, setTrainingMethod] = useState<
    "text" | "reddit" | "both"
  >("text");
  const [guardianInstructions, setGuardianInstructions] = useState("");

  const addCustomTone = () => {
    if (!newToneTitle.trim() || !newToneInstructions.trim()) return;

    const newTone: CustomTone = {
      id: Date.now().toString(),
      title: newToneTitle,
      emoji: newToneEmoji || "🎯",
      instructions: newToneInstructions,
    };

    setCustomTones([...customTones, newTone]);
    setNewToneTitle("");
    setNewToneEmoji("");
    setNewToneInstructions("");
  };

  const updateCustomTone = (id: string, updates: Partial<CustomTone>) => {
    setCustomTones(
      customTones.map((tone) =>
        tone.id === id ? { ...tone, ...updates } : tone
      )
    );
  };

  const deleteCustomTone = (id: string) => {
    setCustomTones(customTones.filter((tone) => tone.id !== id));
    if (selectedTone === id) {
      setSelectedTone("ask");
    }
  };

  const analyzeStyle = async () => {
    if (!posts.trim()) return;

    setIsAnalyzing(true);
    try {
      const response = await fetch("/api/analyze-style", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          posts: posts.split("\n\n").filter((p) => p.trim()),
        }),
      });

      const data = await response.json();
      setStyleResult(
        data.style ||
          "Analysis complete! Your writing style has been processed."
      );
    } catch (error) {
      console.error("Analysis failed:", error);
      setStyleResult("Analysis failed. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const importFromReddit = async () => {
    if (!redditUsername.trim()) return;

    setIsImporting(true);
    try {
      const response = await fetch(
        `https://www.reddit.com/user/${redditUsername}/submitted.json`
      );
      const data = await response.json();

      const posts = data.data.children
        .slice(0, 10)
        .map((post: any) => post.data.selftext || post.data.title)
        .filter((text: string) => text && text.length > 20);

      if (posts.length > 0) {
        setPosts(posts.join("\n\n"));
        const styleResponse = await fetch("/api/analyze-style", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ posts }),
        });

        const styleData = await styleResponse.json();
        setStyleResult(
          styleData.style || "Reddit posts imported and analyzed!"
        );
      } else {
        setStyleResult("No suitable posts found for this Reddit user.");
      }
    } catch (error) {
      console.error("Reddit import failed:", error);
      setStyleResult(
        "Failed to import from Reddit. Please check the username."
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="bg-[#f6f1e8] py-12 px-6">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-black text-black mb-6 text-balance">
            Settings & Personalization
          </h1>
          <p className="text-xl text-black/80 max-w-2xl mx-auto text-pretty">
            Customize your reply tones and train the AI on your writing style.
          </p>
        </div>

        <div className="space-y-8">
          <Card className="chunky-card border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-black">
                Reply Tone Settings
              </CardTitle>
              <CardDescription className="text-black/70">
                Choose your default reply tone and create custom tones for
                different situations
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="border-t-2 border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-black mb-4">
                  Create Custom Tone
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                  <div>
                    <Label
                      htmlFor="tone-title"
                      className="text-sm font-bold text-black mb-1 block"
                    >
                      Tone Title
                    </Label>
                    <Input
                      id="tone-title"
                      placeholder="e.g., Professional, Casual, Witty"
                      value={newToneTitle}
                      onChange={(e) => setNewToneTitle(e.target.value)}
                      className="border-2 border-black rounded-lg"
                    />
                  </div>
                </div>
                <div className="mb-4">
                  <Label
                    htmlFor="tone-instructions"
                    className="text-sm font-bold text-black mb-1 block"
                  >
                    Instructions for AI
                  </Label>
                  <Textarea
                    id="tone-instructions"
                    placeholder="Describe how the AI should respond in this tone. e.g., 'Be professional and concise, avoid emojis, use formal language'"
                    value={newToneInstructions}
                    onChange={(e) => setNewToneInstructions(e.target.value)}
                    className="border-2 border-black rounded-lg min-h-[80px]"
                  />
                </div>
                <Button
                  onClick={addCustomTone}
                  disabled={!newToneTitle.trim() || !newToneInstructions.trim()}
                  className="chunky-button bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                >
                  Add Custom Tone
                </Button>
              </div>

              <div className="border-t-2 border-gray-200 pt-6">
                <h3 className="text-lg font-bold text-black mb-4">
                  🛡️ Guardian - Do Not Add
                </h3>
                <p className="text-sm text-black/70 mb-4">
                  Set guidelines for what the AI should never include in
                  replies. These instructions help prevent unwanted content or
                  topics.
                </p>
                <div className="mb-4">
                  <Label
                    htmlFor="guardian-instructions"
                    className="text-sm font-bold text-black mb-1 block"
                  >
                    Guardian Instructions
                  </Label>
                  <Textarea
                    id="guardian-instructions"
                    placeholder="e.g., 'Never include political opinions, avoid controversial topics, don't use profanity, never share personal information'"
                    value={guardianInstructions}
                    onChange={(e) => setGuardianInstructions(e.target.value)}
                    className="border-2 border-black rounded-lg min-h-[100px]"
                  />
                </div>
                <Button className="chunky-button bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]">
                  Save Guardian Rules
                </Button>
              </div>

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
                            <div className="grid grid-cols-2 gap-3">
                              <Input
                                value={tone.title}
                                onChange={(e) =>
                                  updateCustomTone(tone.id, {
                                    title: e.target.value,
                                  })
                                }
                                className="border-2 border-black rounded-lg"
                              />
                              <Input
                                value={tone.emoji}
                                onChange={(e) =>
                                  updateCustomTone(tone.id, {
                                    emoji: e.target.value,
                                  })
                                }
                                className="border-2 border-black rounded-lg"
                                maxLength={2}
                              />
                            </div>
                            <Textarea
                              value={tone.instructions}
                              onChange={(e) =>
                                updateCustomTone(tone.id, {
                                  instructions: e.target.value,
                                })
                              }
                              className="border-2 border-black rounded-lg min-h-[60px]"
                            />
                            <div className="flex gap-2">
                              <Button
                                onClick={() => setEditingTone(null)}
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
                                {tone.emoji} {tone.title}
                              </h4>
                              <p className="text-sm text-black/70 mt-1">
                                {tone.instructions}
                              </p>
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

          <Card className="chunky-card border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-black">
                Train Your Personal Writing Style
              </CardTitle>
              <CardDescription className="text-black/70">
                Paste your posts directly for AI to learn your unique voice
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <Label className="text-lg font-bold text-black mb-3 block">
                  Training Method
                </Label>
                <div className="flex gap-2 mb-6">
                  <Button
                    onClick={() => setTrainingMethod("text")}
                    variant={trainingMethod === "text" ? "default" : "outline"}
                    className={`chunky-button font-bold py-2 px-4 rounded-lg border-2 border-black shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] ${
                      trainingMethod === "text"
                        ? "bg-orange-500 hover:bg-orange-600 text-white"
                        : "bg-white hover:bg-gray-50 text-black"
                    }`}
                  >
                    📝 Text Input
                  </Button>
                </div>
              </div>

              {(trainingMethod === "text" || trainingMethod === "both") && (
                <div>
                  <Label
                    htmlFor="posts"
                    className="text-lg font-bold text-black mb-2 block"
                  >
                    Your Posts
                  </Label>
                  <Textarea
                    id="posts"
                    placeholder="Paste 3–5 of your posts here..."
                    value={posts}
                    onChange={(e) => setPosts(e.target.value)}
                    className="min-h-[200px] border-2 border-black rounded-lg resize-none text-black placeholder:text-black/50"
                  />
                </div>
              )}

              {(trainingMethod === "reddit" || trainingMethod === "both") && (
                <div>
                  <Label
                    htmlFor="reddit-username"
                    className="text-lg font-bold text-black mb-2 block"
                  >
                    Reddit Username
                  </Label>
                  <Input
                    id="reddit-username"
                    placeholder="Enter your Reddit username"
                    value={redditUsername}
                    onChange={(e) => setRedditUsername(e.target.value)}
                    className="border-2 border-black rounded-lg text-black placeholder:text-black/50"
                  />
                </div>
              )}

              <div className="flex gap-3">
                {(trainingMethod === "text" || trainingMethod === "both") && (
                  <Button
                    onClick={analyzeStyle}
                    disabled={!posts.trim() || isAnalyzing}
                    className="chunky-button flex-1 bg-orange-500 hover:bg-orange-600 text-white font-bold py-3 px-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {isAnalyzing ? "Analyzing..." : "Analyze Text Style"}
                  </Button>
                )}
                {(trainingMethod === "reddit" || trainingMethod === "both") && (
                  <Button
                    onClick={importFromReddit}
                    disabled={!redditUsername.trim() || isImporting}
                    className="chunky-button flex-1 bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-6 rounded-lg border-2 border-black shadow-[4px_4px_0px_0px_rgba(0,0,0,1)]"
                  >
                    {isImporting ? "Importing..." : "Import from Reddit"}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>

          <Card className="chunky-card border-4 border-black bg-white shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
            <CardHeader>
              <CardTitle className="text-2xl font-black text-black">
                Your Style Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="min-h-[100px] p-4 bg-gray-50 border-2 border-gray-200 rounded-lg">
                <p className="text-black">
                  {styleResult || "Your style will appear here after analysis."}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
