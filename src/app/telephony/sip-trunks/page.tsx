"use client";

import { useCallback, useEffect, useState } from "react";
import {
  sipTrunkApi,
  type SipInboundTrunk,
  type CreateSipTrunkRequest,
} from "@/lib/api";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Phone, Plus, Pencil, Trash2, Loader2 } from "lucide-react";

export default function SipTrunksPage() {
  const [trunks, setTrunks] = useState<SipInboundTrunk[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTrunk, setEditingTrunk] = useState<SipInboundTrunk | null>(
    null
  );
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNumbers, setFormNumbers] = useState("");
  const [formAllowedNumbers, setFormAllowedNumbers] = useState("");
  const [formAllowedAddresses, setFormAllowedAddresses] = useState("");
  const [formKrispEnabled, setFormKrispEnabled] = useState(false);
  const [formMetadata, setFormMetadata] = useState("");

  const fetchTrunks = useCallback(async () => {
    try {
      setLoading(true);
      const data = await sipTrunkApi.list();
      setTrunks(data);
    } catch (err: any) {
      toast.error(err.message || "Failed to load SIP trunks");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTrunks();
  }, [fetchTrunks]);

  const resetForm = () => {
    setFormName("");
    setFormNumbers("");
    setFormAllowedNumbers("");
    setFormAllowedAddresses("");
    setFormKrispEnabled(false);
    setFormMetadata("");
    setEditingTrunk(null);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (trunk: SipInboundTrunk) => {
    setEditingTrunk(trunk);
    setFormName(trunk.name || "");
    setFormNumbers((trunk.numbers || []).join(", "));
    setFormAllowedNumbers((trunk.allowedNumbers || []).join(", "));
    setFormAllowedAddresses((trunk.allowedAddresses || []).join(", "));
    setFormKrispEnabled(trunk.krispEnabled || false);
    setFormMetadata(trunk.metadata || "");
    setDialogOpen(true);
  };

  const parseCommaSeparated = (val: string): string[] =>
    val
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Name is required");
      return;
    }
    const numbers = parseCommaSeparated(formNumbers);
    // if (!editingTrunk && numbers.length === 0) {
    //   toast.error("At least one phone number is required");
    //   return;
    // }

    setSaving(true);
    try {
      if (editingTrunk) {
        await sipTrunkApi.update(editingTrunk.sipTrunkId, {
          name: formName,
          metadata: formMetadata || undefined,
        });
        toast.success("SIP trunk updated");
      } else {
        const payload: CreateSipTrunkRequest = {
          name: formName,
          numbers,
          allowedNumbers: parseCommaSeparated(formAllowedNumbers),
          allowedAddresses: parseCommaSeparated(formAllowedAddresses),
          krispEnabled: formKrispEnabled,
          metadata: formMetadata || undefined,
        };
        await sipTrunkApi.create(payload);
        toast.success("SIP trunk created");
      }
      setDialogOpen(false);
      resetForm();
      fetchTrunks();
    } catch (err: any) {
      toast.error(err.message || "Failed to save SIP trunk");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await sipTrunkApi.delete(id);
      toast.success("SIP trunk deleted");
      setDeleteConfirmId(null);
      fetchTrunks();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete SIP trunk");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">SIP Trunks</h1>
          <p className="text-muted-foreground">
            Manage inbound SIP trunks for accepting calls via LiveKit.
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="mr-2 h-4 w-4" />
          Create Trunk
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Phone className="h-5 w-5" />
            Inbound Trunks
          </CardTitle>
          <CardDescription>
            Inbound trunks define how your SIP provider connects to LiveKit.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : trunks.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <Phone className="h-10 w-10 text-muted-foreground mb-3" />
              <p className="text-muted-foreground">No SIP trunks found</p>
              <p className="text-sm text-muted-foreground">
                Create your first inbound trunk to start accepting calls.
              </p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Numbers</TableHead>
                  <TableHead>Allowed Numbers</TableHead>
                  <TableHead>Krisp</TableHead>
                  <TableHead>Trunk ID</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trunks.map((trunk) => (
                  <TableRow key={trunk.sipTrunkId}>
                    <TableCell className="font-medium">
                      {trunk.name || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(trunk.numbers || []).map((n) => (
                          <Badge key={n} variant="secondary">
                            {n}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {(trunk.allowedNumbers || []).length > 0
                          ? trunk.allowedNumbers.map((n) => (
                              <Badge key={n} variant="outline">
                                {n}
                              </Badge>
                            ))
                          : "All"}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={trunk.krispEnabled ? "default" : "secondary"}
                      >
                        {trunk.krispEnabled ? "Enabled" : "Disabled"}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {trunk.sipTrunkId}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(trunk)}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() =>
                            setDeleteConfirmId(trunk.sipTrunkId)
                          }
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editingTrunk ? "Edit SIP Trunk" : "Create SIP Trunk"}
            </DialogTitle>
            <DialogDescription>
              {editingTrunk
                ? "Update the trunk configuration."
                : "Configure a new inbound SIP trunk for your SIP provider."}
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                placeholder="My trunk"
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
              />
            </div>

            {!editingTrunk && (
              <>
                <div className="grid gap-2">
                  <Label htmlFor="numbers">
                    Phone Numbers{" "}
                    <span className="text-xs text-muted-foreground">
                      (comma-separated)
                    </span>
                  </Label>
                  <Input
                    id="numbers"
                    placeholder="+15105550100, +15105550101"
                    value={formNumbers}
                    onChange={(e) => setFormNumbers(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowedNumbers">
                    Allowed Numbers{" "}
                    <span className="text-xs text-muted-foreground">
                      (optional, comma-separated)
                    </span>
                  </Label>
                  <Input
                    id="allowedNumbers"
                    placeholder="+13105550100"
                    value={formAllowedNumbers}
                    onChange={(e) => setFormAllowedNumbers(e.target.value)}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="allowedAddresses">
                    Allowed Addresses{" "}
                    <span className="text-xs text-muted-foreground">
                      (optional, comma-separated IPs)
                    </span>
                  </Label>
                  <Input
                    id="allowedAddresses"
                    placeholder="192.168.1.10"
                    value={formAllowedAddresses}
                    onChange={(e) => setFormAllowedAddresses(e.target.value)}
                  />
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    id="krispEnabled"
                    checked={formKrispEnabled}
                    onChange={(e) => setFormKrispEnabled(e.target.checked)}
                    className="h-4 w-4 rounded border-gray-300"
                  />
                  <Label htmlFor="krispEnabled">
                    Enable Krisp Noise Cancellation
                  </Label>
                </div>
              </>
            )}

            <div className="grid gap-2">
              <Label htmlFor="metadata">
                Metadata{" "}
                <span className="text-xs text-muted-foreground">
                  (optional)
                </span>
              </Label>
              <Input
                id="metadata"
                placeholder='{"team": "sales"}'
                value={formMetadata}
                onChange={(e) => setFormMetadata(e.target.value)}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDialogOpen(false)}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {editingTrunk ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteConfirmId}
        onOpenChange={() => setDeleteConfirmId(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete SIP Trunk</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this SIP trunk? This action cannot
              be undone. Incoming calls using this trunk will stop working.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteConfirmId(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteConfirmId && handleDelete(deleteConfirmId)}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
